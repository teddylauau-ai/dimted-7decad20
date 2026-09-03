ALTER TABLE public.game_progress
  ADD COLUMN IF NOT EXISTS best_pct integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pulse_items (
  slug text PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_coins integer NOT NULL DEFAULT 0,
  required_level integer NOT NULL DEFAULT 1,
  rarity text NOT NULL DEFAULT 'common',
  feat text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pulse_items TO authenticated;
GRANT SELECT ON public.pulse_items TO anon;
GRANT ALL ON public.pulse_items TO service_role;
ALTER TABLE public.pulse_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pulse items readable" ON public.pulse_items FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.pulse_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  coins integer NOT NULL DEFAULT 0,
  equipped_icon text NOT NULL DEFAULT 'cube-origin',
  equipped_ship text NOT NULL DEFAULT 'ship-standard',
  equipped_ball text NOT NULL DEFAULT 'ball-standard',
  equipped_wave text NOT NULL DEFAULT 'wave-standard',
  equipped_trail text NOT NULL DEFAULT 'trail-plasma',
  equipped_death text NOT NULL DEFAULT 'death-shatter',
  equipped_colors text NOT NULL DEFAULT 'col-aurora',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pulse_state TO authenticated;
GRANT ALL ON public.pulse_state TO service_role;
ALTER TABLE public.pulse_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own pulse state" ON public.pulse_state FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER pulse_state_updated_at BEFORE UPDATE ON public.pulse_state
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.pulse_state_for_me()
RETURNS public.pulse_state
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE st public.pulse_state;
BEGIN
  SELECT * INTO st FROM public.pulse_state WHERE user_id = auth.uid();
  IF st.user_id IS NULL AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.pulse_state (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO st FROM public.pulse_state WHERE user_id = auth.uid();
  END IF;
  RETURN st;
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_account_level(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE xp integer; lvl integer := 1; need integer; acc integer := 0;
BEGIN
  SELECT total_xp INTO xp FROM public.profiles WHERE id = _user_id;
  IF xp IS NULL THEN RETURN 1; END IF;
  LOOP
    need := round((260 + 180 * power(lvl - 1, 1.32)) / 10) * 10;
    EXIT WHEN acc + need > xp OR lvl > 200;
    acc := acc + need;
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_finish(_level integer, _pct integer, _time_ms integer, _coins integer, _practice boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  st public.pulse_state;
  lvl integer := greatest(1, least(coalesce(_level, 1), 30));
  pct integer := greatest(0, least(coalesce(_pct, 0), 100));
  ms integer := greatest(0, least(coalesce(_time_ms, 0), 3600000));
  coin_mask integer := greatest(0, least(coalesce(_coins, 0), 7));
  existing public.game_progress;
  new_coins integer := 0;
  reward integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(auth.uid()) THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  st := public.pulse_state_for_me();

  IF coalesce(_practice, false) THEN
    RETURN jsonb_build_object('status', 'practice', 'coins', st.coins);
  END IF;

  SELECT * INTO existing FROM public.game_progress
  WHERE user_id = auth.uid() AND game = 'pulse-rush' AND level = lvl LIMIT 1;

  IF existing.id IS NULL THEN
    new_coins := (coin_mask & 1) + ((coin_mask >> 1) & 1) + ((coin_mask >> 2) & 1);
    INSERT INTO public.game_progress (user_id, game, level, stars, best_ms, best_pct, coins, attempts)
    VALUES (auth.uid(), 'pulse-rush', lvl,
            CASE WHEN pct >= 100 THEN 1 ELSE 0 END,
            CASE WHEN pct >= 100 THEN ms ELSE NULL END,
            pct, coin_mask, 1);
    reward := CASE WHEN pct >= 100 THEN 30 + lvl * 6 ELSE 0 END + new_coins * 12;
  ELSE
    new_coins := ((coin_mask & ~existing.coins) & 1)
               + (((coin_mask & ~existing.coins) >> 1) & 1)
               + (((coin_mask & ~existing.coins) >> 2) & 1);
    reward := CASE
                WHEN pct >= 100 AND coalesce(existing.best_pct, 0) < 100 THEN 30 + lvl * 6
                WHEN pct > coalesce(existing.best_pct, 0) THEN greatest(1, (pct - existing.best_pct) / 4)
                ELSE 0
              END + new_coins * 12;
    UPDATE public.game_progress
    SET best_pct = greatest(coalesce(existing.best_pct, 0), pct),
        coins = existing.coins | coin_mask,
        stars = greatest(coalesce(existing.stars, 0), CASE WHEN pct >= 100 THEN 1 ELSE 0 END),
        attempts = coalesce(existing.attempts, 0) + 1,
        best_ms = CASE WHEN pct >= 100 THEN least(coalesce(existing.best_ms, ms), ms) ELSE existing.best_ms END
    WHERE id = existing.id;
  END IF;

  IF reward > 0 THEN
    UPDATE public.pulse_state SET coins = coins + reward WHERE user_id = auth.uid() RETURNING * INTO st;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'coins', st.coins, 'gained', reward,
                            'level', lvl, 'pct', pct, 'new_coins', new_coins);
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_unlock(_slug text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  item public.pulse_items;
  st public.pulse_state;
  lvl integer;
  feat_kind text;
  feat_n integer;
  have integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  SELECT * INTO item FROM public.pulse_items WHERE slug = _slug;
  IF item.slug IS NULL THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  st := public.pulse_state_for_me();

  IF EXISTS (SELECT 1 FROM public.game_unlocks WHERE user_id = auth.uid() AND game = 'pulse-rush' AND slug = _slug) THEN
    RETURN jsonb_build_object('status', 'owned');
  END IF;

  lvl := public.pulse_account_level(auth.uid());
  IF lvl < item.required_level THEN
    RETURN jsonb_build_object('status', 'locked', 'required_level', item.required_level, 'level', lvl);
  END IF;

  IF item.feat IS NOT NULL THEN
    feat_kind := split_part(item.feat, ':', 1);
    feat_n := coalesce(nullif(split_part(item.feat, ':', 2), '')::integer, 1);
    IF feat_kind = 'clears' THEN
      SELECT count(*) INTO have FROM public.game_progress
      WHERE user_id = auth.uid() AND game = 'pulse-rush' AND best_pct >= 100;
    ELSIF feat_kind = 'coins' THEN
      SELECT coalesce(sum((coins & 1) + ((coins >> 1) & 1) + ((coins >> 2) & 1)), 0) INTO have
      FROM public.game_progress WHERE user_id = auth.uid() AND game = 'pulse-rush';
    ELSIF feat_kind = 'insane' THEN
      SELECT count(*) INTO have FROM public.game_progress
      WHERE user_id = auth.uid() AND game = 'pulse-rush' AND best_pct >= 100 AND level >= 12;
    ELSIF feat_kind = 'allcoins' THEN
      SELECT count(*) INTO have FROM public.game_progress
      WHERE user_id = auth.uid() AND game = 'pulse-rush' AND best_pct >= 100 AND coins = 7;
    ELSE
      have := 0;
    END IF;
    IF coalesce(have, 0) < feat_n THEN
      RETURN jsonb_build_object('status', 'feat_locked', 'feat', item.feat, 'have', coalesce(have, 0), 'need', feat_n);
    END IF;
  END IF;

  IF st.coins < item.price_coins THEN
    RETURN jsonb_build_object('status', 'insufficient', 'coins', st.coins, 'price', item.price_coins);
  END IF;

  INSERT INTO public.game_unlocks (user_id, game, slug) VALUES (auth.uid(), 'pulse-rush', _slug)
  ON CONFLICT DO NOTHING;
  IF item.price_coins > 0 THEN
    UPDATE public.pulse_state SET coins = coins - item.price_coins WHERE user_id = auth.uid() RETURNING * INTO st;
  END IF;

  RETURN jsonb_build_object('status', 'unlocked', 'coins', st.coins, 'slug', _slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.pulse_equip(_slot text, _slug text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  st public.pulse_state;
  item public.pulse_items;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  st := public.pulse_state_for_me();

  SELECT * INTO item FROM public.pulse_items WHERE slug = _slug;
  IF item.slug IS NULL OR item.kind <> _slot THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  IF item.price_coins > 0 OR item.feat IS NOT NULL OR item.required_level > 1 THEN
    IF NOT EXISTS (SELECT 1 FROM public.game_unlocks WHERE user_id = auth.uid() AND game = 'pulse-rush' AND slug = _slug) THEN
      RETURN jsonb_build_object('status', 'not_owned');
    END IF;
  END IF;

  CASE _slot
    WHEN 'icon'   THEN UPDATE public.pulse_state SET equipped_icon = _slug WHERE user_id = auth.uid();
    WHEN 'ship'   THEN UPDATE public.pulse_state SET equipped_ship = _slug WHERE user_id = auth.uid();
    WHEN 'ball'   THEN UPDATE public.pulse_state SET equipped_ball = _slug WHERE user_id = auth.uid();
    WHEN 'wave'   THEN UPDATE public.pulse_state SET equipped_wave = _slug WHERE user_id = auth.uid();
    WHEN 'trail'  THEN UPDATE public.pulse_state SET equipped_trail = _slug WHERE user_id = auth.uid();
    WHEN 'death'  THEN UPDATE public.pulse_state SET equipped_death = _slug WHERE user_id = auth.uid();
    WHEN 'colors' THEN UPDATE public.pulse_state SET equipped_colors = _slug WHERE user_id = auth.uid();
    ELSE RETURN jsonb_build_object('status', 'unknown_slot');
  END CASE;

  SELECT * INTO st FROM public.pulse_state WHERE user_id = auth.uid();
  RETURN jsonb_build_object('status', 'equipped', 'slot', _slot, 'slug', _slug);
END;
$$;

REVOKE ALL ON FUNCTION public.pulse_state_for_me() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pulse_account_level(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pulse_finish(integer, integer, integer, integer, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pulse_unlock(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pulse_equip(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pulse_state_for_me() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_account_level(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_finish(integer, integer, integer, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_unlock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pulse_equip(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.award_arcade_xp(_game text, _score integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prof public.profiles;
  score_clamped integer;
  base integer;
  multiplier integer := 1;
  gained integer;
  sparks_gained integer;
  runs_today integer;
  best integer;
  is_best boolean := false;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  IF _game NOT IN (
    'nova-blocks', 'aurora-drift', 'pulse-grid',
    'spectre-dash', 'prism-break', 'comet-sling', 'nova-fusion', 'signal-type',
    'nova-rift', 'revision-quiz', 'nova-vanguard', 'pulse-rush'
  ) THEN
    RETURN jsonb_build_object('status', 'unknown_game');
  END IF;

  score_clamped := greatest(0, least(coalesce(_score, 0), 500000));

  IF EXISTS (
    SELECT 1 FROM public.xp_events e
    WHERE e.user_id = prof.id AND e.source = 'arcade' AND e.created_at > now() - interval '45 seconds'
  ) THEN
    RETURN jsonb_build_object('status', 'cooldown', 'total_xp', prof.total_xp, 'sparks', prof.sparks);
  END IF;

  SELECT count(*) INTO runs_today FROM public.xp_events e
  WHERE e.user_id = prof.id AND e.source = 'arcade' AND e.created_at > now() - interval '1 day';

  IF runs_today >= 24 THEN
    RETURN jsonb_build_object('status', 'capped', 'total_xp', prof.total_xp, 'sparks', prof.sparks, 'runs_left', 0);
  END IF;

  SELECT coalesce(max(score), 0) INTO best FROM public.game_scores
  WHERE user_id = prof.id AND game = _game;
  IF score_clamped > best THEN is_best := true; END IF;

  base := least(220, 20 + round(sqrt(score_clamped) * 2.2)::integer);
  IF is_best THEN base := base + 30; END IF;

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN
    multiplier := 2;
  END IF;

  gained := base * multiplier;
  sparks_gained := greatest(1, gained / 5);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, 'arcade', gained, _game || ' · ' || score_clamped::text);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      energy = least(100, energy + greatest(1, gained / 14)),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object(
    'status', 'granted',
    'gained', gained,
    'sparks_gained', sparks_gained,
    'personal_best', is_best,
    'runs_left', 23 - runs_today,
    'total_xp', prof.total_xp,
    'sparks', prof.sparks,
    'energy', prof.energy
  );
END;
$function$;

INSERT INTO public.pulse_items (slug, kind, name, description, price_coins, required_level, rarity, feat) VALUES
('cube-origin','icon','Origin','The default cube. Clean edges, no story.',0,1,'common',NULL),
('cube-chrome','icon','Chrome','Mirror-polished steel.',40,1,'common',NULL),
('cube-ember','icon','Ember','Slow-burning core.',60,1,'common',NULL),
('cube-circuit','icon','Circuit','Etched traces that pulse on jump.',90,1,'uncommon',NULL),
('cube-glitch','icon','Glitch','Never quite renders the same twice.',120,1,'uncommon',NULL),
('cube-prism','icon','Prism','Splits light across every face.',160,1,'uncommon',NULL),
('cube-obsidian','icon','Obsidian','Matte black, razor bevel.',200,1,'rare',NULL),
('cube-aurora','icon','Aurora','Sky-ribbon shimmer.',260,1,'rare',NULL),
('cube-nova','icon','Nova','Contained detonation.',340,1,'rare',NULL),
('cube-magma','icon','Magma','Cracked crust, molten seams.',420,1,'epic',NULL),
('cube-void','icon','Void','Absorbs its own trail.',520,1,'epic',NULL),
('cube-halo','icon','Halo','Ringed in cold light.',640,1,'epic',NULL),
('cube-relic','icon','Relic','Recovered from an unfinished level.',0,1,'legendary','clears:5'),
('cube-hunter','icon','Coin Hunter','For the ones who take the risky route.',0,1,'legendary','coins:12'),
('cube-demon','icon','Demon','Only shown to people who cleared the hard ones.',0,1,'legendary','insane:1'),
('cube-flawless','icon','Flawless','Full clear, all three coins, one level.',0,1,'legendary','allcoins:1'),
('cube-ascend','icon','Ascendant','Account level 20+.',0,20,'mythic',NULL),
('cube-prime','icon','Prime','Account level 45+.',0,45,'mythic',NULL),
('ship-standard','ship','Standard Wing','Stock flight frame.',0,1,'common',NULL),
('ship-dart','ship','Dart','Narrow, fast-reading silhouette.',80,1,'common',NULL),
('ship-kite','ship','Kite','Wide wings, easy to judge.',120,1,'uncommon',NULL),
('ship-raptor','ship','Raptor','Swept aggressive frame.',220,1,'rare',NULL),
('ship-seraph','ship','Seraph','Twin halo thrusters.',360,1,'epic',NULL),
('ship-eclipse','ship','Eclipse','Awarded for 8 clears.',0,1,'legendary','clears:8'),
('ball-standard','ball','Standard Orb','Stock gravity ball.',0,1,'common',NULL),
('ball-gyro','ball','Gyro','Spins visibly with gravity flips.',100,1,'common',NULL),
('ball-quasar','ball','Quasar','Bright ring, dark core.',240,1,'rare',NULL),
('ball-singularity','ball','Singularity','Bends the background around it.',400,1,'epic',NULL),
('wave-standard','wave','Standard Dart','Stock wave form.',0,1,'common',NULL),
('wave-needle','wave','Needle','Thin and precise.',110,1,'common',NULL),
('wave-serpent','wave','Serpent','Long tapering body.',250,1,'rare',NULL),
('wave-phantom','wave','Phantom','Half-transparent, hard mode flex.',420,1,'epic',NULL),
('trail-plasma','trail','Plasma','Default teal streak.',0,1,'common',NULL),
('trail-ember','trail','Ember','Sparks that fall behind you.',70,1,'common',NULL),
('trail-stardust','trail','Stardust','Fine glittering dust.',130,1,'uncommon',NULL),
('trail-ribbon','trail','Void Ribbon','A single smooth dark ribbon.',210,1,'rare',NULL),
('trail-pulse','trail','Pulse Wave','Rings dropped on the beat.',280,1,'rare',NULL),
('trail-aurora','trail','Aurora Veil','Colour-shifting sheet.',380,1,'epic',NULL),
('trail-fracture','trail','Fracture','Shards that spin off on jumps.',480,1,'epic',NULL),
('trail-eternal','trail','Eternal','Never fades. 20 coins collected.',0,1,'legendary','coins:20'),
('death-shatter','death','Shatter','Break into clean shards.',0,1,'common',NULL),
('death-implode','death','Implosion','Collapse inward, then flash.',90,1,'common',NULL),
('death-pixel','death','Pixel Burst','Dissolve into a grid.',150,1,'uncommon',NULL),
('death-nova','death','Nova Bloom','Bright expanding ring.',240,1,'rare',NULL),
('death-static','death','Static','Snap to noise for a frame.',320,1,'rare',NULL),
('death-collapse','death','Collapse','Space folds where you were.',440,1,'epic',NULL),
('death-silence','death','Silence','No effect at all. Just gone.',0,1,'legendary','clears:12'),
('col-aurora','colors','Aurora','Teal and gold.',0,1,'common',NULL),
('col-ember','colors','Ember','Orange and deep red.',50,1,'common',NULL),
('col-frost','colors','Frost','Ice blue and white.',50,1,'common',NULL),
('col-toxic','colors','Toxic','Acid green and black.',80,1,'uncommon',NULL),
('col-royal','colors','Royal','Indigo and pale gold.',110,1,'uncommon',NULL),
('col-blood','colors','Blood','Crimson and charcoal.',140,1,'rare',NULL),
('col-mono','colors','Monochrome','White on white.',180,1,'rare',NULL),
('col-prime','colors','Prime','Reserved for the deep ladder.',0,30,'mythic',NULL)
ON CONFLICT (slug) DO NOTHING;