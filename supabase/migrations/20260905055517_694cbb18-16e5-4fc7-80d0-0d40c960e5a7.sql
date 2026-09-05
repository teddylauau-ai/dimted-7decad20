CREATE OR REPLACE FUNCTION public.crew_contribute_xp(_crew_id uuid, _amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt integer;
  new_total integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Not signed in'); END IF;
  IF NOT public.is_crew_member(_crew_id, auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not a crew member');
  END IF;
  IF public.is_banned(auth.uid()) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Account restricted');
  END IF;

  amt := greatest(0, least(coalesce(_amount, 0), 1200));

  UPDATE public.crews SET total_xp = total_xp + amt, updated_at = now()
  WHERE id = _crew_id
  RETURNING total_xp INTO new_total;

  RETURN jsonb_build_object('ok', true, 'added', amt, 'total_xp', new_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crew_contribute_xp(uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.award_arcade_xp(_game text, _score integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof public.profiles;
  score_clamped integer;
  base integer;
  multiplier integer := 1;
  gained integer;
  sparks_gained integer;
  best integer;
  is_best boolean := false;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;

  IF _game NOT IN (
    'nova-blocks', 'aurora-drift', 'pulse-grid',
    'spectre-dash', 'prism-break', 'comet-sling', 'nova-fusion', 'signal-type',
    'nova-rift', 'revision-quiz', 'nova-vanguard', 'pulse-rush', 'crew-flight'
  ) THEN
    RETURN jsonb_build_object('status', 'unknown_game');
  END IF;

  score_clamped := greatest(0, least(coalesce(_score, 0), 500000));

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
    'total_xp', prof.total_xp, 'sparks', prof.sparks, 'energy', prof.energy);
END;
$$;