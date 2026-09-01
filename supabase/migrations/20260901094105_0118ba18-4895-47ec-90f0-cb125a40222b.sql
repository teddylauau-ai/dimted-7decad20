-- 1. Arcade XP: a solo progression path that doesn't need other players online.
CREATE OR REPLACE FUNCTION public.award_arcade_xp(_game text, _score integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof public.profiles;
  best integer;
  runs integer;
  base integer;
  gained integer;
  sparks_gained integer;
  multiplier integer := 1;
  beat_best boolean := false;
  daily_cap constant integer := 18;
  score_clamped integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  IF _game NOT IN ('nova-blocks', 'aurora-drift', 'pulse-grid') THEN
    RETURN jsonb_build_object('status', 'unknown_game');
  END IF;

  score_clamped := greatest(0, least(coalesce(_score, 0), 1000000));

  -- Short anti-spam cooldown between paid runs of the same game.
  IF EXISTS (
    SELECT 1 FROM public.xp_events e
    WHERE e.user_id = prof.id
      AND e.source = 'arcade'
      AND e.label LIKE _game || '%'
      AND e.created_at > now() - interval '45 seconds'
  ) THEN
    RETURN jsonb_build_object('status', 'cooldown', 'total_xp', prof.total_xp,
      'energy', prof.energy, 'sparks', prof.sparks);
  END IF;

  SELECT count(*) INTO runs FROM public.xp_events e
  WHERE e.user_id = prof.id AND e.source = 'arcade' AND e.created_at > now() - interval '1 day';

  IF runs >= daily_cap THEN
    RETURN jsonb_build_object('status', 'capped', 'total_xp', prof.total_xp,
      'energy', prof.energy, 'sparks', prof.sparks);
  END IF;

  SELECT coalesce(max(score), 0) INTO best FROM public.game_scores
  WHERE user_id = prof.id AND game = _game;

  -- Base reward scales with score but flattens out, so long grinds still pay less than variety.
  base := 25 + least(175, floor(sqrt(score_clamped) * 4)::integer);
  IF score_clamped > best THEN
    beat_best := true;
    base := base + 60;
  END IF;

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN
    multiplier := 2;
  END IF;

  gained := base * multiplier;
  sparks_gained := greatest(2, gained / 5);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, 'arcade', gained, _game || ' · ' || score_clamped::text);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      energy = least(100, energy + greatest(2, gained / 10)),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object(
    'status', 'granted',
    'gained', gained,
    'personal_best', beat_best,
    'sparks_gained', sparks_gained,
    'sparks', prof.sparks,
    'total_xp', prof.total_xp,
    'energy', prof.energy,
    'surge_until', prof.surge_until,
    'runs_left', daily_cap - runs - 1
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.award_arcade_xp(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_arcade_xp(text, integer) TO authenticated;

-- 2. The founding account owns Dimted, forever. Nobody after the first can get owner.
CREATE OR REPLACE FUNCTION public.claim_founder_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'owner') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_created_claim_owner ON public.profiles;
CREATE TRIGGER on_profile_created_claim_owner
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.claim_founder_owner();

-- Belt and braces: the owner role can never be inserted from the client.
DROP POLICY IF EXISTS user_roles_insert_staff ON public.user_roles;
CREATE POLICY user_roles_insert_staff
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (
    role <> 'owner'
    AND (
      public.has_role(auth.uid(), 'owner')
      OR (public.has_role(auth.uid(), 'admin') AND role IN ('moderator', 'member'))
    )
  );

DROP POLICY IF EXISTS user_roles_delete_staff ON public.user_roles;
CREATE POLICY user_roles_delete_staff
  ON public.user_roles FOR DELETE TO authenticated
  USING (
    role <> 'owner'
    AND (
      public.has_role(auth.uid(), 'owner')
      OR (public.has_role(auth.uid(), 'admin') AND role IN ('moderator', 'member'))
    )
  );