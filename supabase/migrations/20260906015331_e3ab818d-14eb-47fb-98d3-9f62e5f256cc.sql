CREATE OR REPLACE FUNCTION public.arcade_game_par(_game text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
  SELECT CASE _game
    WHEN 'nova-blocks' THEN 900
    WHEN 'aurora-drift' THEN 6000
    WHEN 'pulse-grid' THEN 40000
    WHEN 'spectre-dash' THEN 1200
    WHEN 'prism-break' THEN 4000
    WHEN 'comet-sling' THEN 12000
    WHEN 'nova-fusion' THEN 3000
    WHEN 'signal-type' THEN 8000
    WHEN 'tower-stack' THEN 2500
    WHEN 'lane-hop' THEN 220
    WHEN 'echo-sequence' THEN 600
    WHEN 'neon-coil' THEN 1800
    WHEN 'nova-rift' THEN 1800
    WHEN 'pulse-rush' THEN 3000
    WHEN 'nova-vanguard' THEN 2000
    WHEN 'revision-quiz' THEN 800
    WHEN 'crew-flight' THEN 700
    ELSE NULL
  END::numeric
$fn$;

CREATE OR REPLACE FUNCTION public.arcade_game_weight(_game text)
RETURNS numeric LANGUAGE sql IMMUTABLE SET search_path = public AS $fn$
  SELECT CASE _game
    WHEN 'nova-blocks' THEN 1.20
    WHEN 'nova-rift' THEN 1.20
    WHEN 'nova-fusion' THEN 1.15
    WHEN 'pulse-rush' THEN 1.15
    WHEN 'prism-break' THEN 1.10
    WHEN 'spectre-dash' THEN 1.10
    WHEN 'crew-flight' THEN 1.05
    WHEN 'nova-vanguard' THEN 1.05
    WHEN 'comet-sling' THEN 1.00
    WHEN 'neon-coil' THEN 1.00
    WHEN 'revision-quiz' THEN 1.00
    WHEN 'tower-stack' THEN 0.95
    WHEN 'lane-hop' THEN 0.95
    WHEN 'aurora-drift' THEN 0.90
    WHEN 'signal-type' THEN 0.90
    WHEN 'pulse-grid' THEN 0.85
    WHEN 'echo-sequence' THEN 0.85
    ELSE 1.00
  END::numeric
$fn$;

GRANT EXECUTE ON FUNCTION public.arcade_game_par(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.arcade_game_weight(text) TO authenticated, anon;

CREATE OR REPLACE FUNCTION public.award_arcade_xp(_game text, _score integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  prof public.profiles;
  score_clamped integer;
  par numeric;
  weight numeric;
  ratio numeric;
  base integer;
  multiplier integer := 1;
  lvl integer;
  scale numeric;
  gained integer;
  sparks_gained integer;
  best integer;
  is_best boolean := false;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;

  par := public.arcade_game_par(_game);
  IF par IS NULL THEN RETURN jsonb_build_object('status', 'unknown_game'); END IF;
  weight := public.arcade_game_weight(_game);

  score_clamped := greatest(0, least(coalesce(_score, 0), 500000));

  SELECT coalesce(max(score), 0) INTO best FROM public.game_scores
  WHERE user_id = prof.id AND game = _game;
  IF score_clamped > best THEN is_best := true; END IF;

  ratio := least(4.0, score_clamped::numeric / par);
  base := least(950, round((70 + 470 * sqrt(ratio)) * weight)::integer);
  IF is_best THEN base := base + 90; END IF;

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN multiplier := 2; END IF;

  lvl := public.level_from_xp(prof.total_xp);
  scale := 1 + (greatest(1, lvl) - 1) * 0.04;

  gained := greatest(1, round(base * multiplier * scale)::integer);
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
$fn$;

CREATE OR REPLACE FUNCTION public.arcade_top_players(_limit integer DEFAULT 25)
RETURNS TABLE (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  equipped_nametag text,
  equipped_badge text,
  equipped_frame text,
  equipped_effect text,
  arcade_xp bigint,
  runs bigint
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $fn$
  SELECT p.id, p.username, p.display_name, p.avatar_url,
         p.equipped_nametag, p.equipped_badge, p.equipped_frame, p.equipped_effect,
         sum(e.amount)::bigint AS arcade_xp,
         count(*)::bigint AS runs
  FROM public.xp_events e
  JOIN public.profiles p ON p.id = e.user_id
  WHERE e.source = 'arcade'
  GROUP BY p.id
  ORDER BY arcade_xp DESC
  LIMIT greatest(1, least(coalesce(_limit, 25), 100));
$fn$;

GRANT EXECUTE ON FUNCTION public.arcade_top_players(integer) TO authenticated;