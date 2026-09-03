-- 1) Real shop rotation: pools big enough that the shelves actually change.
UPDATE public.cosmetics SET pool = 'core'
WHERE rarity = 'common';

UPDATE public.cosmetics SET pool = 'daily'
WHERE rarity IN ('uncommon', 'rare');

-- Keep a small permanent starter shelf so the shop is never empty of basics.
UPDATE public.cosmetics SET pool = 'core'
WHERE slug IN (
  SELECT slug FROM public.cosmetics WHERE rarity = 'uncommon' ORDER BY price_sparks ASC LIMIT 4
);

UPDATE public.cosmetics SET pool = 'weekly'
WHERE rarity IN ('epic', 'legendary');

UPDATE public.cosmetics SET pool = 'limited', available_until = NULL
WHERE rarity = 'mythic';

-- 2) Make the ladder reachable: richer arcade payouts, higher daily headroom.
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

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN
    multiplier := 2;
  END IF;

  gained := base * multiplier;
  sparks_gained := greatest(2, gained / 4);

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
    'status', 'awarded',
    'gained', gained,
    'sparks_gained', sparks_gained,
    'total_xp', prof.total_xp,
    'sparks', prof.sparks,
    'energy', prof.energy,
    'runs_left', greatest(0, 40 - runs_today - 1)
  );
END;
$function$;

-- 3) Social/chat XP: same anti-spam shape, payouts that add up over a session.
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
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

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

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN
    multiplier := 2;
  END IF;

  gained := base * multiplier;
  sparks_gained := greatest(1, gained / 4);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, _source, gained, _label);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      energy = least(100, energy + greatest(1, gained / 20)),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object(
    'status', 'awarded',
    'gained', gained,
    'sparks_gained', sparks_gained,
    'total_xp', prof.total_xp,
    'energy', prof.energy,
    'sparks', prof.sparks
  );
END;
$function$;