CREATE OR REPLACE FUNCTION public.award_bonus_xp(_kind text, _ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prof public.profiles;
  bonus_key text;
  amount integer := 0;
  ok boolean := false;
  n integer;
  lvl integer;
  gained integer;
  sparks_gained integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(prof.id) THEN RETURN jsonb_build_object('status', 'banned'); END IF;

  IF _kind = 'study_mastery' THEN
    SELECT coalesce(max(best_percent), 0) INTO n FROM public.study_progress
      WHERE user_id = prof.id AND deck = _ref;
    IF n >= 100 THEN
      bonus_key := 'study:' || _ref || ':100'; amount := 350; ok := true;
    ELSIF n >= 80 THEN
      bonus_key := 'study:' || _ref || ':80'; amount := 200; ok := true;
    END IF;
  ELSIF _kind = 'pulse_first_clear' THEN
    n := nullif(_ref, '')::integer;
    SELECT count(*) > 0 INTO ok FROM public.game_progress
      WHERE user_id = prof.id AND game = 'pulse' AND level = n AND best_pct >= 100;
    bonus_key := 'pulse:first:' || n;
    amount := 90 + least(n, 27) * 10;
  ELSIF _kind = 'skyward_gates' THEN
    n := nullif(_ref, '')::integer;
    IF n NOT IN (25, 50, 100, 150, 200) THEN RETURN jsonb_build_object('status', 'unknown_ref'); END IF;
    SELECT coalesce(max((detail->>'gates')::integer), 0) >= n INTO ok FROM public.game_scores
      WHERE user_id = prof.id AND game = 'skyward' AND detail ? 'gates';
    bonus_key := 'skyward:gates:' || n;
    amount := n * 6;
  ELSE
    RETURN jsonb_build_object('status', 'unknown_kind');
  END IF;

  IF NOT ok THEN RETURN jsonb_build_object('status', 'not_earned'); END IF;
  IF EXISTS (SELECT 1 FROM public.xp_once o WHERE o.user_id = prof.id AND o.key = bonus_key) THEN
    RETURN jsonb_build_object('status', 'already_claimed');
  END IF;

  lvl := public.level_from_xp(prof.total_xp);
  gained := greatest(1, round(amount * (1 + (greatest(1, lvl) - 1) * 0.04))::integer);
  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN gained := gained * 2; END IF;
  sparks_gained := greatest(8, gained / 3);

  INSERT INTO public.xp_once (user_id, key, amount) VALUES (prof.id, bonus_key, gained)
  ON CONFLICT (user_id, key) DO NOTHING;

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, _kind, gained, bonus_key);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object('status', 'awarded', 'gained', gained, 'sparks_gained', sparks_gained,
    'total_xp', prof.total_xp, 'sparks', prof.sparks, 'key', bonus_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_bonus_xp(text, text) TO authenticated;