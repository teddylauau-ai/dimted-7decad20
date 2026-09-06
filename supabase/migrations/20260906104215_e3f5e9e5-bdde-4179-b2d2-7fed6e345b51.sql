-- 1) Cosmetics: support '*' for the whole wardrobe
CREATE OR REPLACE FUNCTION public.staff_grant_cosmetic(_user_id uuid, _slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  item public.cosmetics;
  v_owner boolean := public.has_role(auth.uid(), 'owner');
  v_target_staff boolean;
  v_count integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  v_target_staff := public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'owner');

  IF _slug = '*' THEN
    IF NOT v_owner THEN
      RETURN jsonb_build_object('status', 'owner_only');
    END IF;

    INSERT INTO public.inventory (user_id, cosmetic_slug)
    SELECT _user_id, c.slug
    FROM public.cosmetics c
    WHERE (c.pool NOT IN ('owner', 'admin', 'founder'))
       OR (c.pool IN ('admin', 'founder') AND v_target_staff)
       OR (c.pool = 'owner' AND public.has_role(_user_id, 'owner'))
    ON CONFLICT DO NOTHING;

    SELECT count(*) INTO v_count FROM public.inventory WHERE user_id = _user_id;

    INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
    VALUES (auth.uid(), _user_id, 'grant_cosmetic_all', jsonb_build_object('owned', v_count));

    RETURN jsonb_build_object('status', 'granted', 'slug', '*', 'owned', v_count);
  END IF;

  SELECT * INTO item FROM public.cosmetics WHERE slug = _slug;
  IF item.slug IS NULL THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  IF item.pool = 'owner' AND NOT (v_owner AND public.has_role(_user_id, 'owner')) THEN
    RETURN jsonb_build_object('status', 'owner_only');
  END IF;

  IF item.pool IN ('admin', 'founder') THEN
    IF NOT v_owner THEN
      RETURN jsonb_build_object('status', 'owner_only');
    END IF;
    IF NOT v_target_staff THEN
      RETURN jsonb_build_object('status', 'staff_only');
    END IF;
  END IF;

  INSERT INTO public.inventory (user_id, cosmetic_slug)
  VALUES (_user_id, _slug)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_cosmetic', jsonb_build_object('slug', _slug, 'pool', item.pool));

  RETURN jsonb_build_object('status', 'granted', 'slug', _slug);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_grant_cosmetic(uuid, text) FROM PUBLIC, anon;

-- 2) Nova Rift grants: coins, stars, one item or the whole catalogue
CREATE OR REPLACE FUNCTION public.staff_grant_rift(
  _user_id uuid,
  _slug text DEFAULT NULL,
  _coins integer DEFAULT 0,
  _stars integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_unlocked integer := 0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  INSERT INTO public.rift_state (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;

  IF COALESCE(_coins, 0) <> 0 THEN
    UPDATE public.rift_state
    SET coins_spent = COALESCE(coins_spent, 0) - GREATEST(0, _coins), updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  IF COALESCE(_stars, 0) <> 0 THEN
    UPDATE public.rift_state
    SET stars_spent = COALESCE(stars_spent, 0) - GREATEST(0, _stars), updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  IF _slug = '*' THEN
    INSERT INTO public.rift_unlocks (user_id, slug, cost_stars, paid_coins)
    SELECT _user_id, i.slug, 0, 0 FROM public.rift_items i
    ON CONFLICT DO NOTHING;
  ELSIF _slug IS NOT NULL AND _slug <> '' THEN
    IF NOT EXISTS (SELECT 1 FROM public.rift_items WHERE slug = _slug) THEN
      RETURN jsonb_build_object('status', 'unknown_item');
    END IF;
    INSERT INTO public.rift_unlocks (user_id, slug, cost_stars, paid_coins)
    VALUES (_user_id, _slug, 0, 0)
    ON CONFLICT DO NOTHING;
  END IF;

  SELECT count(*) INTO v_unlocked FROM public.rift_unlocks WHERE user_id = _user_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_rift',
    jsonb_build_object('slug', _slug, 'coins', _coins, 'stars', _stars, 'unlocked', v_unlocked));

  RETURN jsonb_build_object(
    'status', 'ok',
    'unlocked', v_unlocked,
    'coins_available', public.rift_coins_earned(_user_id) - COALESCE((SELECT coins_spent FROM public.rift_state WHERE user_id = _user_id), 0),
    'stars_available', public.rift_stars_earned(_user_id) - COALESCE((SELECT stars_spent FROM public.rift_state WHERE user_id = _user_id), 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_grant_rift(uuid, text, integer, integer) FROM PUBLIC, anon;

-- 3) Nova Rift campaign completion
CREATE OR REPLACE FUNCTION public.staff_complete_rift(_user_id uuid, _levels integer DEFAULT 18)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE i integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  FOR i IN 1..GREATEST(1, LEAST(200, COALESCE(_levels, 18))) LOOP
    INSERT INTO public.game_progress (user_id, game, level, stars, best_pct, attempts)
    VALUES (_user_id, 'nova-rift', i, 3, 100, 1)
    ON CONFLICT (user_id, game, level) DO UPDATE
      SET stars = GREATEST(public.game_progress.stars, 3),
          best_pct = GREATEST(public.game_progress.best_pct, 100),
          updated_at = now();
  END LOOP;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'complete_rift', jsonb_build_object('levels', _levels));

  RETURN jsonb_build_object('status', 'ok', 'levels', _levels);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_complete_rift(uuid, integer) FROM PUBLIC, anon;

-- 4) Nova Vanguard cores
CREATE OR REPLACE FUNCTION public.staff_grant_vanguard(_user_id uuid, _cores integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_cores integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  INSERT INTO public.vanguard_state (user_id, cores)
  VALUES (_user_id, GREATEST(0, COALESCE(_cores, 0)))
  ON CONFLICT (user_id) DO UPDATE
    SET cores = public.vanguard_state.cores + GREATEST(0, COALESCE(_cores, 0)), updated_at = now()
  RETURNING cores INTO v_cores;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_vanguard', jsonb_build_object('cores', _cores));

  RETURN jsonb_build_object('status', 'ok', 'cores', v_cores);
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_grant_vanguard(uuid, integer) FROM PUBLIC, anon;

-- 5) Owner-only exact currency setter
CREATE OR REPLACE FUNCTION public.owner_set_currency(_user_id uuid, _xp integer, _sparks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  UPDATE public.profiles
  SET total_xp = GREATEST(0, COALESCE(_xp, total_xp)),
      sparks = GREATEST(0, COALESCE(_sparks, sparks))
  WHERE id = _user_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'set_currency', jsonb_build_object('xp', _xp, 'sparks', _sparks));

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

REVOKE ALL ON FUNCTION public.owner_set_currency(uuid, integer, integer) FROM PUBLIC, anon;

-- 6) Owner-only: give absolutely everything
CREATE OR REPLACE FUNCTION public.staff_grant_everything(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_max integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  SELECT COALESCE(max(required_level), 100) INTO v_max FROM public.cosmetics;

  PERFORM public.owner_set_currency(_user_id, 301000, 500000);
  PERFORM public.staff_grant_cosmetic(_user_id, '*');
  PERFORM public.staff_grant_pulse(_user_id, '*', 200000);
  PERFORM public.staff_grant_rift(_user_id, '*', 100000, 100000);
  PERFORM public.staff_grant_vanguard(_user_id, 100000);

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_everything', '{}'::jsonb);

  RETURN jsonb_build_object('status', 'ok');
END;
$function$;

REVOKE ALL ON FUNCTION public.staff_grant_everything(uuid) FROM PUBLIC, anon;