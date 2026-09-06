ALTER TABLE public.rift_items ADD COLUMN IF NOT EXISTS cost_coins integer NOT NULL DEFAULT 0;
ALTER TABLE public.rift_state ADD COLUMN IF NOT EXISTS coins_spent integer NOT NULL DEFAULT 0;
ALTER TABLE public.rift_unlocks ADD COLUMN IF NOT EXISTS paid_coins integer NOT NULL DEFAULT 0;

UPDATE public.rift_items SET cost_coins = GREATEST(40, cost_stars * 45) WHERE cost_coins = 0;

INSERT INTO public.rift_items (slug, kind, name, cost_stars, cost_coins) VALUES
  ('level:13','level','Level 13', 14, 640),
  ('level:14','level','Level 14', 15, 700),
  ('level:15','level','Level 15', 16, 760),
  ('level:16','level','Level 16', 17, 820),
  ('level:17','level','Level 17', 18, 900),
  ('level:18','level','Level 18', 20, 1000)
ON CONFLICT (slug) DO UPDATE SET cost_stars = EXCLUDED.cost_stars, cost_coins = EXCLUDED.cost_coins;

CREATE OR REPLACE FUNCTION public.rift_coins_earned(_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(
    GREATEST(4, LEAST(70, round(14 * LEAST(2.0, s.score::numeric / NULLIF(public.arcade_game_par(s.game), 0)))::int))
  ), 0)::int
  FROM public.game_scores s
  WHERE s.user_id = _user_id AND public.arcade_game_par(s.game) IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.rift_state_for_me()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); st public.rift_state;
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('error','auth'); END IF;
  SELECT * INTO st FROM public.rift_state WHERE user_id = uid;
  RETURN jsonb_build_object(
    'runner', COALESCE(st.equipped_runner, 'aurora'),
    'trail', COALESCE(st.equipped_trail, 'ghost'),
    'stars_spent', COALESCE(st.stars_spent, 0),
    'stars_earned', public.rift_stars_earned(uid),
    'stars_available', public.rift_stars_earned(uid) - COALESCE(st.stars_spent, 0),
    'coins_spent', COALESCE(st.coins_spent, 0),
    'coins_earned', public.rift_coins_earned(uid),
    'coins_available', public.rift_coins_earned(uid) - COALESCE(st.coins_spent, 0),
    'unlocks', COALESCE((SELECT jsonb_agg(slug) FROM public.rift_unlocks WHERE user_id = uid), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rift_buy(_slug text, _currency text DEFAULT 'stars')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE uid uuid := auth.uid(); it public.rift_items; spent int; avail int; cur text := lower(COALESCE(_currency,'stars'));
BEGIN
  IF uid IS NULL THEN RETURN jsonb_build_object('status','error','message','Sign in first'); END IF;
  IF cur NOT IN ('stars','coins') THEN RETURN jsonb_build_object('status','error','message','Bad currency'); END IF;
  SELECT * INTO it FROM public.rift_items WHERE slug = _slug;
  IF it.slug IS NULL THEN RETURN jsonb_build_object('status','error','message','Unknown item'); END IF;

  INSERT INTO public.rift_state (user_id) VALUES (uid) ON CONFLICT (user_id) DO NOTHING;

  IF EXISTS (SELECT 1 FROM public.rift_unlocks WHERE user_id = uid AND slug = _slug) THEN
    RETURN jsonb_build_object('status','owned');
  END IF;

  IF cur = 'coins' THEN
    SELECT coins_spent INTO spent FROM public.rift_state WHERE user_id = uid FOR UPDATE;
    avail := public.rift_coins_earned(uid) - COALESCE(spent, 0);
    IF it.cost_coins <= 0 THEN RETURN jsonb_build_object('status','error','message','Not sold for coins'); END IF;
    IF avail < it.cost_coins THEN
      RETURN jsonb_build_object('status','poor','currency','coins','need', it.cost_coins, 'have', avail);
    END IF;
    INSERT INTO public.rift_unlocks (user_id, slug, cost_stars, paid_coins) VALUES (uid, _slug, 0, it.cost_coins);
    UPDATE public.rift_state SET coins_spent = COALESCE(coins_spent,0) + it.cost_coins WHERE user_id = uid;
    RETURN jsonb_build_object('status','bought','currency','coins','slug', _slug,'spent', it.cost_coins,
      'coins_available', public.rift_coins_earned(uid) - (COALESCE(spent,0) + it.cost_coins));
  END IF;

  SELECT stars_spent INTO spent FROM public.rift_state WHERE user_id = uid FOR UPDATE;
  avail := public.rift_stars_earned(uid) - COALESCE(spent, 0);
  IF avail < it.cost_stars THEN
    RETURN jsonb_build_object('status','poor','currency','stars','need', it.cost_stars, 'have', avail);
  END IF;

  INSERT INTO public.rift_unlocks (user_id, slug, cost_stars) VALUES (uid, _slug, it.cost_stars);
  UPDATE public.rift_state SET stars_spent = COALESCE(stars_spent,0) + it.cost_stars WHERE user_id = uid;

  RETURN jsonb_build_object('status','bought','currency','stars','slug', _slug, 'spent', it.cost_stars,
    'stars_available', public.rift_stars_earned(uid) - (COALESCE(spent,0) + it.cost_stars));
END;
$$;

REVOKE ALL ON FUNCTION public.rift_coins_earned(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rift_buy(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rift_state_for_me() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rift_coins_earned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_buy(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_state_for_me() TO authenticated;