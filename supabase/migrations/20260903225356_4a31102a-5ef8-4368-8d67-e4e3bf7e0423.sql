-- Shared level helper so SQL and the app agree on one curve.
CREATE OR REPLACE FUNCTION public.level_from_xp(_xp integer)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE lvl integer := 1; acc integer := 0; need integer; xp integer := greatest(0, coalesce(_xp, 0));
BEGIN
  LOOP
    EXIT WHEN lvl >= 100;
    need := round((90 + 52 * power(lvl - 1, 0.92)) / 10) * 10;
    EXIT WHEN acc + need > xp;
    acc := acc + need;
    lvl := lvl + 1;
  END LOOP;
  RETURN lvl;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pulse_account_level(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.level_from_xp(coalesce((SELECT total_xp FROM public.profiles WHERE id = _user_id), 0))
$function$;

-- Sparks now come in at a real rate, and level gating uses the new curve.
CREATE OR REPLACE FUNCTION public.purchase_cosmetic(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item public.cosmetics;
  prof public.profiles;
  lvl integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;

  SELECT * INTO item FROM public.cosmetics WHERE slug = _slug;
  IF item.slug IS NULL THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  IF item.available_until IS NOT NULL AND item.available_until < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory WHERE user_id = prof.id AND cosmetic_slug = _slug) THEN
    RETURN jsonb_build_object('status', 'owned');
  END IF;

  lvl := public.level_from_xp(prof.total_xp);
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
$function$;

-- Sparks: half of every XP award instead of a quarter.
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
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;

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
    WHERE e.user_id = prof.id AND e.source = 'arcade' AND e.created_at > now() - interval '30 seconds'
  ) THEN
    RETURN jsonb_build_object('status', 'cooldown', 'total_xp', prof.total_xp, 'sparks', prof.sparks);
  END IF;

  SELECT count(*) INTO runs_today FROM public.xp_events e
  WHERE e.user_id = prof.id AND e.source = 'arcade' AND e.created_at > now() - interval '1 day';

  IF runs_today >= 40 THEN
    RETURN jsonb_build_object('status', 'capped', 'total_xp', prof.total_xp, 'sparks', prof.sparks, 'runs_left', 0);
  END IF;

  SELECT coalesce(max(score), 0) INTO best FROM public.game_scores
  WHERE user_id = prof.id AND game = _game;
  IF score_clamped > best THEN is_best := true; END IF;

  base := least(420, 40 + round(sqrt(score_clamped) * 3.4)::integer);
  IF is_best THEN base := base + 60; END IF;

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN multiplier := 2; END IF;

  gained := base * multiplier;
  sparks_gained := greatest(10, gained / 2);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, 'arcade', gained, _game || ' · ' || score_clamped::text);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      energy = least(100, energy + greatest(1, gained / 14)),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object('status', 'awarded', 'gained', gained, 'sparks_gained', sparks_gained,
    'total_xp', prof.total_xp, 'sparks', prof.sparks, 'energy', prof.energy,
    'runs_left', greatest(0, 40 - runs_today - 1));
END;
$function$;

CREATE OR REPLACE FUNCTION public.award_xp(_source text, _label text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prof public.profiles;
  base integer;
  cooldown interval;
  cap integer;
  window_len interval;
  recent integer;
  multiplier integer := 1;
  gained integer;
  sparks_gained integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;

  CASE _source
    WHEN 'message' THEN base := 12; cooldown := interval '45 seconds'; cap := 20; window_len := interval '1 hour';
    WHEN 'conversation' THEN base := 90; cooldown := interval '10 minutes'; cap := 5; window_len := interval '1 day';
    WHEN 'community' THEN base := 110; cooldown := interval '5 minutes'; cap := 8; window_len := interval '1 day';
    WHEN 'friend' THEN base := 220; cooldown := interval '1 minute'; cap := 6; window_len := interval '7 days';
    WHEN 'activity' THEN base := 180; cooldown := interval '1 minute'; cap := 6; window_len := interval '1 day';
    WHEN 'challenge' THEN base := 260; cooldown := interval '0 seconds'; cap := 8; window_len := interval '1 day';
    WHEN 'discovery' THEN base := 140; cooldown := interval '30 seconds'; cap := 8; window_len := interval '1 day';
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

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN multiplier := 2; END IF;

  gained := base * multiplier;
  sparks_gained := greatest(6, gained / 2);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, _source, gained, _label);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      energy = least(100, energy + greatest(1, gained / 20)),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object('status', 'awarded', 'gained', gained, 'sparks_gained', sparks_gained,
    'total_xp', prof.total_xp, 'energy', prof.energy, 'sparks', prof.sparks);
END;
$function$;

-- Quests pay double Sparks so the shop's big-ticket items are reachable.
UPDATE public.quests SET reward_sparks = greatest(reward_sparks * 2, 120);

-- Pulse Rush: owner/admin can grant coins or unlock items for anyone.
CREATE OR REPLACE FUNCTION public.staff_grant_pulse(_user_id uuid, _slug text DEFAULT NULL::text, _coins integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_rank integer := public.my_rank();
  v_coins integer;
  granted integer := 0;
  st public.pulse_state;
BEGIN
  IF v_rank < 30 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  INSERT INTO public.pulse_state (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  IF _slug = '*' THEN
    IF v_rank < 40 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
    INSERT INTO public.game_unlocks (user_id, game, slug)
    SELECT _user_id, 'pulse-rush', i.slug FROM public.pulse_items i
    WHERE NOT EXISTS (
      SELECT 1 FROM public.game_unlocks g
      WHERE g.user_id = _user_id AND g.game = 'pulse-rush' AND g.slug = i.slug
    );
    granted := 1;
  ELSIF _slug IS NOT NULL AND _slug <> '' THEN
    IF NOT EXISTS (SELECT 1 FROM public.pulse_items WHERE slug = _slug) THEN
      RETURN jsonb_build_object('status', 'unknown_item');
    END IF;
    INSERT INTO public.game_unlocks (user_id, game, slug)
    VALUES (_user_id, 'pulse-rush', _slug) ON CONFLICT DO NOTHING;
    granted := 1;
  END IF;

  v_coins := greatest(-1000000, least(coalesce(_coins, 0), CASE WHEN v_rank >= 40 THEN 1000000 ELSE 25000 END));
  IF v_coins <> 0 THEN
    UPDATE public.pulse_state SET coins = greatest(0, coins + v_coins) WHERE user_id = _user_id RETURNING * INTO st;
  ELSE
    SELECT * INTO st FROM public.pulse_state WHERE user_id = _user_id;
  END IF;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_pulse', jsonb_build_object('slug', _slug, 'coins', v_coins));

  RETURN jsonb_build_object('status', 'granted', 'coins', st.coins, 'slug', _slug, 'unlocked', granted);
END;
$function$;

-- Owner-only: mark every Pulse Rush level as fully cleared for a player.
CREATE OR REPLACE FUNCTION public.staff_complete_pulse(_user_id uuid, _levels integer DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE lvl integer; n integer := greatest(1, least(coalesce(_levels, 15), 30));
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  FOR lvl IN 1..n LOOP
    IF EXISTS (SELECT 1 FROM public.game_progress WHERE user_id = _user_id AND game = 'pulse-rush' AND level = lvl) THEN
      UPDATE public.game_progress
      SET best_pct = 100, coins = 7, stars = greatest(stars, 1)
      WHERE user_id = _user_id AND game = 'pulse-rush' AND level = lvl;
    ELSE
      INSERT INTO public.game_progress (user_id, game, level, stars, best_pct, coins, attempts)
      VALUES (_user_id, 'pulse-rush', lvl, 1, 100, 7, 1);
    END IF;
  END LOOP;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'complete_pulse', jsonb_build_object('levels', n));
  RETURN jsonb_build_object('status', 'ok', 'levels', n);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.level_from_xp(integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.staff_grant_pulse(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_complete_pulse(uuid, integer) TO authenticated;