CREATE OR REPLACE FUNCTION public.award_xp(_source text, _label text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prof public.profiles;
  base integer;
  multiplier integer := 1;
  gained integer;
  sparks_gained integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;

  CASE _source
    WHEN 'message' THEN base := 12;
    WHEN 'conversation' THEN base := 90;
    WHEN 'community' THEN base := 110;
    WHEN 'friend' THEN base := 220;
    WHEN 'activity' THEN base := 180;
    WHEN 'challenge' THEN base := 260;
    WHEN 'discovery' THEN base := 140;
    ELSE RETURN jsonb_build_object('status', 'unknown_source');
  END CASE;

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
$function$;