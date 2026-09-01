-- 1. Sparks currency + equipped cosmetic slots on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sparks integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS equipped_nametag text,
  ADD COLUMN IF NOT EXISTS equipped_badge text,
  ADD COLUMN IF NOT EXISTS equipped_frame text,
  ADD COLUMN IF NOT EXISTS equipped_banner text,
  ADD COLUMN IF NOT EXISTS equipped_effect text;

-- 2. Cosmetic catalogue
CREATE TABLE IF NOT EXISTS public.cosmetics (
  slug text PRIMARY KEY,
  name text NOT NULL,
  slot text NOT NULL CHECK (slot IN ('nametag','badge','frame','banner','effect')),
  rarity text NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary','mythic')),
  description text NOT NULL DEFAULT '',
  price_sparks integer NOT NULL DEFAULT 0,
  required_level integer NOT NULL DEFAULT 1,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cosmetics TO authenticated;
GRANT SELECT ON public.cosmetics TO anon;
GRANT ALL ON public.cosmetics TO service_role;
ALTER TABLE public.cosmetics ENABLE ROW LEVEL SECURITY;
CREATE POLICY cosmetics_select_everyone ON public.cosmetics FOR SELECT TO anon, authenticated USING (true);

-- 3. Inventory: what each player owns
CREATE TABLE IF NOT EXISTS public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cosmetic_slug text NOT NULL REFERENCES public.cosmetics(slug) ON DELETE CASCADE,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, cosmetic_slug)
);

GRANT SELECT ON public.inventory TO authenticated;
GRANT ALL ON public.inventory TO service_role;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
-- Everyone signed in can see what others own (profiles are public inside DIMTED);
-- writes only ever happen through purchase_cosmetic / grant functions.
CREATE POLICY inventory_select_signed_in ON public.inventory FOR SELECT TO authenticated USING (true);

-- 4. Seed the shop
INSERT INTO public.cosmetics (slug, name, slot, rarity, description, price_sparks, required_level, featured) VALUES
  ('tag-frost',     'Frostline',        'nametag', 'common',    'A cool steady blue on your name.',                  120,  1,  false),
  ('tag-aurora',    'Aurora',           'nametag', 'uncommon',  'Teal-to-green gradient, the DIMTED house colour.',  320,  3,  true),
  ('tag-ember',     'Ember',            'nametag', 'uncommon',  'Warm gold fade for people who never log off.',      320,  3,  false),
  ('tag-violet',    'Violet Hour',      'nametag', 'rare',      'Deep violet with a soft outer glow.',               760,  8,  false),
  ('tag-prism',     'Prism',            'nametag', 'epic',      'Slow-shifting rainbow sweep across your name.',    1600, 14,  true),
  ('tag-eclipse',   'Eclipse',          'nametag', 'legendary', 'Black-gold shimmer that moves while you talk.',    3200, 22,  false),
  ('tag-mythos',    'Mythos',           'nametag', 'mythic',    'Only visible to people who got this far.',         6400, 32,  true),
  ('badge-spark',   'First Spark',      'badge',   'common',    'A small spark beside your name.',                    90,  1,  false),
  ('badge-owl',     'Night Owl',        'badge',   'uncommon',  'For the 3am conversation crowd.',                   280,  4,  false),
  ('badge-founder', 'Early Signal',     'badge',   'rare',      'You were here before the crowd.',                   700,  7,  false),
  ('badge-crown',   'Crown',            'badge',   'epic',      'A quiet gold crown. No explanation given.',        1500, 16,  false),
  ('badge-void',    'Void Mark',        'badge',   'legendary', 'Something is watching through it.',                3000, 24,  false),
  ('frame-hairline','Hairline',         'frame',   'common',    'A crisp ring around your avatar.',                  110,  1,  false),
  ('frame-pulse',   'Pulse Ring',       'frame',   'uncommon',  'Breathes gently while you are online.',             340,  5,  true),
  ('frame-orbit',   'Orbit',            'frame',   'rare',      'A thin ring with a travelling highlight.',          820,  9,  false),
  ('frame-halo',    'Halo',             'frame',   'epic',      'Layered glow that reacts to your level colour.',   1700, 18,  false),
  ('frame-relic',   'Relic',            'frame',   'mythic',    'Looks older than the app itself.',                 6000, 30,  false),
  ('banner-drift',  'Night Drift',      'banner',  'common',    'Calm navy gradient banner.',                        150,  1,  false),
  ('banner-aurora', 'Aurora Field',     'banner',  'uncommon',  'Aurora sweeping across your profile header.',       420,  6,  false),
  ('banner-solar',  'Solar Flare',      'banner',  'rare',      'Gold flare rising behind your name.',               900, 11,  true),
  ('banner-nebula', 'Nebula',           'banner',  'epic',      'Slow-drifting deep-space profile header.',         1900, 20,  false),
  ('banner-signal', 'Signal Lost',      'banner',  'legendary', 'Scan lines and static. Deliberately.',             3400, 26,  false),
  ('fx-fade',       'Soft Entry',       'effect',  'common',    'Your messages fade in instead of snapping.',        130,  1,  false),
  ('fx-slide',      'Slipstream',       'effect',  'uncommon',  'Messages slide in from the edge.',                   360,  6,  false),
  ('fx-spark',      'Sparkfall',        'effect',  'rare',      'A tiny spark trails your new messages.',            880, 12,  false),
  ('fx-ripple',     'Ripple',           'effect',  'epic',      'A ripple passes through the row you post in.',     1800, 19,  false)
ON CONFLICT (slug) DO NOTHING;

-- 5. Buying: server-side, atomic, checks level + balance + ownership
CREATE OR REPLACE FUNCTION public.purchase_cosmetic(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.cosmetics;
  prof public.profiles;
  lvl integer;
  need integer;
  acc integer := 0;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  SELECT * INTO item FROM public.cosmetics WHERE slug = _slug;
  IF item.slug IS NULL THEN
    RETURN jsonb_build_object('status', 'unknown_item');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory WHERE user_id = prof.id AND cosmetic_slug = _slug) THEN
    RETURN jsonb_build_object('status', 'owned');
  END IF;

  -- Mirror of the client level curve: xpForLevel(n) = round((260 + 180*(n-1)^1.32)/10)*10
  lvl := 1;
  LOOP
    need := round((260 + 180 * power(lvl - 1, 1.32)) / 10) * 10;
    EXIT WHEN acc + need > prof.total_xp OR lvl > 200;
    acc := acc + need;
    lvl := lvl + 1;
  END LOOP;

  IF lvl < item.required_level THEN
    RETURN jsonb_build_object('status', 'locked', 'required_level', item.required_level, 'level', lvl);
  END IF;

  IF prof.sparks < item.price_sparks THEN
    RETURN jsonb_build_object('status', 'insufficient', 'sparks', prof.sparks, 'price', item.price_sparks);
  END IF;

  UPDATE public.profiles SET sparks = sparks - item.price_sparks WHERE id = prof.id RETURNING * INTO prof;
  INSERT INTO public.inventory (user_id, cosmetic_slug) VALUES (prof.id, _slug);

  RETURN jsonb_build_object('status', 'purchased', 'sparks', prof.sparks, 'slug', _slug);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_cosmetic(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_cosmetic(text) TO authenticated;

-- 6. Equipping: one item per slot, must be owned
CREATE OR REPLACE FUNCTION public.equip_cosmetic(_slug text, _slot text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item public.cosmetics;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  IF _slug IS NOT NULL THEN
    SELECT * INTO item FROM public.cosmetics WHERE slug = _slug;
    IF item.slug IS NULL OR item.slot <> _slot THEN
      RETURN jsonb_build_object('status', 'unknown_item');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.inventory WHERE user_id = auth.uid() AND cosmetic_slug = _slug) THEN
      RETURN jsonb_build_object('status', 'not_owned');
    END IF;
  END IF;

  CASE _slot
    WHEN 'nametag' THEN UPDATE public.profiles SET equipped_nametag = _slug WHERE id = auth.uid();
    WHEN 'badge'   THEN UPDATE public.profiles SET equipped_badge   = _slug WHERE id = auth.uid();
    WHEN 'frame'   THEN UPDATE public.profiles SET equipped_frame   = _slug WHERE id = auth.uid();
    WHEN 'banner'  THEN UPDATE public.profiles SET equipped_banner  = _slug WHERE id = auth.uid();
    WHEN 'effect'  THEN UPDATE public.profiles SET equipped_effect  = _slug WHERE id = auth.uid();
    ELSE RETURN jsonb_build_object('status', 'unknown_slot');
  END CASE;

  RETURN jsonb_build_object('status', 'equipped', 'slot', _slot, 'slug', _slug);
END;
$$;

REVOKE ALL ON FUNCTION public.equip_cosmetic(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.equip_cosmetic(text, text) TO authenticated;

-- 7. XP events also pay Sparks, under the exact same cooldowns and caps
CREATE OR REPLACE FUNCTION public.award_xp(_source text, _label text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base integer;
  cooldown interval;
  cap integer;
  window_len interval;
  recent integer;
  multiplier integer := 1;
  gained integer;
  sparks_gained integer;
  prof public.profiles;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  CASE _source
    WHEN 'message' THEN base := 4; cooldown := interval '60 seconds'; cap := 15; window_len := interval '1 hour';
    WHEN 'conversation' THEN base := 40; cooldown := interval '10 minutes'; cap := 3; window_len := interval '1 day';
    WHEN 'community' THEN base := 60; cooldown := interval '5 minutes'; cap := 5; window_len := interval '1 day';
    WHEN 'friend' THEN base := 120; cooldown := interval '1 minute'; cap := 5; window_len := interval '7 days';
    WHEN 'activity' THEN base := 100; cooldown := interval '1 minute'; cap := 4; window_len := interval '1 day';
    WHEN 'challenge' THEN base := 150; cooldown := interval '0 seconds'; cap := 6; window_len := interval '1 day';
    WHEN 'discovery' THEN base := 80; cooldown := interval '30 seconds'; cap := 6; window_len := interval '1 day';
    ELSE RETURN jsonb_build_object('status', 'unknown_source');
  END CASE;

  IF cooldown > interval '0 seconds' AND EXISTS (
    SELECT 1 FROM public.xp_events e
    WHERE e.user_id = prof.id AND e.source = _source AND e.created_at > now() - cooldown
  ) THEN
    RETURN jsonb_build_object('status', 'cooldown', 'total_xp', prof.total_xp, 'energy', prof.energy, 'sparks', prof.sparks);
  END IF;

  SELECT count(*) INTO recent FROM public.xp_events e
  WHERE e.user_id = prof.id AND e.source = _source AND e.created_at > now() - window_len;

  IF recent >= cap THEN
    RETURN jsonb_build_object('status', 'capped', 'total_xp', prof.total_xp, 'energy', prof.energy, 'sparks', prof.sparks);
  END IF;

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN
    multiplier := 2;
  END IF;
  gained := base * multiplier;
  sparks_gained := greatest(1, gained / 4);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, _source, gained, _label);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      energy = least(100, energy + greatest(1, (gained / 12))),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object(
    'status', 'granted',
    'gained', gained,
    'sparks_gained', sparks_gained,
    'sparks', prof.sparks,
    'total_xp', prof.total_xp,
    'energy', prof.energy,
    'surge_until', prof.surge_until
  );
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(text, text) TO authenticated;