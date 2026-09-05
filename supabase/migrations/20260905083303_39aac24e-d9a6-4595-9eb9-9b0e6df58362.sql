-- 1. Crew contribution: clamp, ban check, per-member tracking, and a proper return payload
CREATE OR REPLACE FUNCTION public.crew_contribute_xp(_crew_id uuid, _amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  amt integer;
  new_total integer;
  mine integer;
BEGIN
  IF v_uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crew_members WHERE crew_id = _crew_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_member');
  END IF;
  IF public.is_banned(v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'restricted');
  END IF;

  amt := greatest(0, least(coalesce(_amount, 0), 1200));

  UPDATE public.crews SET total_xp = total_xp + amt, updated_at = now()
  WHERE id = _crew_id
  RETURNING total_xp INTO new_total;

  UPDATE public.crew_members SET contributed_xp = contributed_xp + amt
  WHERE crew_id = _crew_id AND user_id = v_uid
  RETURNING contributed_xp INTO mine;

  RETURN jsonb_build_object('ok', true, 'added', amt, 'total_xp', new_total, 'contributed_xp', mine);
END;
$$;

GRANT EXECUTE ON FUNCTION public.crew_contribute_xp(uuid, integer) TO authenticated;

-- 2. Backfill: share each crew's untracked XP evenly across its current members
WITH totals AS (
  SELECT c.id,
         greatest(0, c.total_xp - coalesce((SELECT sum(m.contributed_xp) FROM public.crew_members m WHERE m.crew_id = c.id), 0)) AS gap,
         greatest(1, (SELECT count(*) FROM public.crew_members m WHERE m.crew_id = c.id)) AS members
  FROM public.crews c
)
UPDATE public.crew_members m
SET contributed_xp = m.contributed_xp + (t.gap / t.members)::integer
FROM totals t
WHERE m.crew_id = t.id AND t.gap > 0;

-- 3. Record arcade runs as scores again (best-score tracking + leaderboards)
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

  INSERT INTO public.game_scores (user_id, game, score, detail)
  VALUES (prof.id, _game, score_clamped, jsonb_build_object('xp', gained));

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
    'total_xp', prof.total_xp, 'sparks', prof.sparks, 'energy', prof.energy, 'best', is_best);
END;
$$;
