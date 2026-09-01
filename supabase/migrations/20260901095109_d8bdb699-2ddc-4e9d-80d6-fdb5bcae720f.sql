ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Avatar storage: private bucket, readable by signed-in members, writable only by the owner.
CREATE POLICY "Members can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can replace their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

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
    'spectre-dash', 'prism-break', 'comet-sling', 'nova-fusion', 'signal-type'
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

  IF runs_today >= 18 THEN
    RETURN jsonb_build_object('status', 'capped', 'total_xp', prof.total_xp, 'sparks', prof.sparks, 'runs_left', 0);
  END IF;

  SELECT coalesce(max(score), 0) INTO best FROM public.game_scores
  WHERE user_id = prof.id AND game = _game;
  IF score_clamped > best THEN is_best := true; END IF;

  -- Square-root curve: better runs pay more, but never runaway.
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
    'runs_left', 17 - runs_today,
    'total_xp', prof.total_xp,
    'sparks', prof.sparks,
    'energy', prof.energy
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.award_arcade_xp(text, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.award_arcade_xp(text, integer) TO authenticated;