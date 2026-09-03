CREATE OR REPLACE FUNCTION public.vanguard_finish(_level integer, _time_ms integer, _stars integer, _cores integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st public.vanguard_state;
  lvl integer := greatest(1, least(coalesce(_level, 1), 24));
  stars integer := greatest(0, least(coalesce(_stars, 0), 3));
  gained integer := greatest(0, least(coalesce(_cores, 0), 400));
  ms integer := greatest(0, least(coalesce(_time_ms, 0), 3600000));
  existing public.game_progress;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(auth.uid()) THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  st := public.vanguard_state_for_me();

  SELECT * INTO existing FROM public.game_progress
  WHERE user_id = auth.uid() AND game = 'nova-vanguard' AND level = lvl LIMIT 1;

  IF existing.id IS NULL THEN
    INSERT INTO public.game_progress (user_id, game, level, stars, best_ms)
    VALUES (auth.uid(), 'nova-vanguard', lvl, stars, ms);
  ELSE
    UPDATE public.game_progress
    SET stars = greatest(coalesce(existing.stars, 0), stars),
        best_ms = least(coalesce(existing.best_ms, ms), ms)
    WHERE id = existing.id;
  END IF;

  UPDATE public.vanguard_state SET cores = cores + gained
  WHERE user_id = auth.uid()
  RETURNING * INTO st;

  RETURN jsonb_build_object('status', 'ok', 'cores', st.cores, 'gained_cores', gained, 'level', lvl, 'stars', stars);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.vanguard_finish(integer, integer, integer, integer) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.vanguard_finish(integer, integer, integer, integer) TO authenticated;