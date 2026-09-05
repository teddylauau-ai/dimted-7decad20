-- 1. Daily login streak ------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS streak_claimed_on date;

CREATE OR REPLACE FUNCTION public.claim_daily_streak()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prof public.profiles;
  today date := (now() AT TIME ZONE 'utc')::date;
  new_streak integer;
  base integer;
  lvl integer;
  scale numeric;
  gained integer;
  sparks_gained integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(prof.id) THEN RETURN jsonb_build_object('status', 'banned'); END IF;
  IF prof.streak_claimed_on = today THEN
    RETURN jsonb_build_object('status', 'already_claimed', 'streak', prof.streak);
  END IF;

  IF prof.streak_claimed_on = today - 1 THEN
    new_streak := least(365, coalesce(prof.streak, 0) + 1);
  ELSE
    new_streak := 1;
  END IF;

  -- 120 XP on day one, +40 per consecutive day, capped at 600 (day 14).
  base := least(600, 120 + (least(new_streak, 14) - 1) * 40);
  lvl := public.level_from_xp(prof.total_xp);
  scale := 1 + (greatest(1, lvl) - 1) * 0.04;
  gained := greatest(1, round(base * scale)::integer);
  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN gained := gained * 2; END IF;
  sparks_gained := greatest(10, gained / 3);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, 'streak', gained, 'Day ' || new_streak || ' streak');

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      streak = new_streak,
      streak_claimed_on = today,
      energy = least(100, energy + 10),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object('status', 'awarded', 'gained', gained, 'sparks_gained', sparks_gained,
    'streak', new_streak, 'total_xp', prof.total_xp, 'sparks', prof.sparks);
END;
$$;

-- 2. Achievements ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.achievements (
  slug text PRIMARY KEY,
  title text NOT NULL,
  blurb text NOT NULL,
  metric text NOT NULL,
  goal integer NOT NULL,
  reward_xp integer NOT NULL DEFAULT 0,
  reward_sparks integer NOT NULL DEFAULT 0,
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.achievements TO anon;
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Achievements are public" ON public.achievements;
CREATE POLICY "Achievements are public" ON public.achievements FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.achievement_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  slug text NOT NULL REFERENCES public.achievements(slug) ON DELETE CASCADE,
  reward_xp integer NOT NULL DEFAULT 0,
  reward_sparks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, slug)
);
GRANT SELECT ON public.achievement_claims TO authenticated;
GRANT ALL ON public.achievement_claims TO service_role;
ALTER TABLE public.achievement_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own achievement claims" ON public.achievement_claims;
CREATE POLICY "Own achievement claims" ON public.achievement_claims FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS achievement_claims_user_idx ON public.achievement_claims (user_id);

INSERT INTO public.achievements (slug, title, blurb, metric, goal, reward_xp, reward_sparks, rarity) VALUES
  ('first-words',      'First Words',       'Send your first message.',                     'messages', 1, 150, 60, 'common'),
  ('chatterbox',       'Chatterbox',        'Send 100 messages.',                           'messages', 100, 900, 320, 'uncommon'),
  ('voice-of-lazu',    'Voice of Lazu',     'Send 1,000 messages.',                         'messages', 1000, 4200, 1200, 'epic'),
  ('first-friend',     'First Friend',      'Make one friend.',                             'friends', 1, 250, 90, 'common'),
  ('circle',           'Inner Circle',      'Reach 5 friends.',                             'friends', 5, 1100, 380, 'rare'),
  ('crew-hand',        'Deckhand',          'Contribute 1,000 XP to a crew.',               'crew_xp', 1000, 700, 260, 'uncommon'),
  ('crew-pillar',      'Crew Pillar',       'Contribute 25,000 XP to a crew.',              'crew_xp', 25000, 3600, 1000, 'epic'),
  ('pulse-first',      'Pulse Rookie',      'Clear your first Pulse Rush level.',           'pulse_clears', 1, 300, 110, 'common'),
  ('pulse-ten',        'Rhythm Runner',     'Clear 10 Pulse Rush levels.',                  'pulse_clears', 10, 1800, 620, 'rare'),
  ('pulse-all',        'Pulse Master',      'Clear 27 Pulse Rush levels.',                  'pulse_clears', 27, 6000, 1800, 'legendary'),
  ('skyward-50',       'Gate Crasher',      'Clear 50 Skyward gates in one run.',           'skyward_gates', 50, 900, 320, 'uncommon'),
  ('skyward-150',      'Sky Sovereign',     'Clear 150 Skyward gates in one run.',          'skyward_gates', 150, 3000, 900, 'epic'),
  ('study-80',         'Straight Shooter',  'Score 80% or better on any study deck.',       'study_best', 80, 500, 180, 'common'),
  ('study-100',        'Perfect Recall',    'Score 100% on any study deck.',                'study_best', 100, 1500, 500, 'rare')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title, blurb = EXCLUDED.blurb, metric = EXCLUDED.metric, goal = EXCLUDED.goal,
  reward_xp = EXCLUDED.reward_xp, reward_sparks = EXCLUDED.reward_sparks, rarity = EXCLUDED.rarity;

-- Server-truth progress for one user, so nothing is trusted from the client.
CREATE OR REPLACE FUNCTION public.achievement_progress(_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'messages',
      (SELECT count(*) FROM public.messages WHERE sender_id = _user_id)
      + (SELECT count(*) FROM public.general_messages WHERE user_id = _user_id)
      + (SELECT count(*) FROM public.crew_messages WHERE user_id = _user_id AND body NOT LIKE '/sys:%'),
    'friends',
      (SELECT count(*) FROM public.friendships
        WHERE status = 'accepted' AND (user_a = _user_id OR user_b = _user_id)),
    'crew_xp',
      (SELECT coalesce(max(contributed_xp), 0) FROM public.crew_members WHERE user_id = _user_id),
    'pulse_clears',
      (SELECT count(*) FROM public.game_progress
        WHERE user_id = _user_id AND game = 'pulse' AND best_pct >= 100),
    'skyward_gates',
      (SELECT coalesce(max((detail->>'gates')::integer), 0) FROM public.game_scores
        WHERE user_id = _user_id AND game = 'skyward' AND detail ? 'gates'),
    'study_best',
      (SELECT coalesce(max(best_percent), 0) FROM public.study_progress WHERE user_id = _user_id)
  );
$$;

-- Claim every achievement whose goal is genuinely met.
CREATE OR REPLACE FUNCTION public.sync_achievements()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prof public.profiles;
  prog jsonb;
  a public.achievements;
  total_xp_gain integer := 0;
  total_sparks integer := 0;
  earned jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(prof.id) THEN RETURN jsonb_build_object('status', 'banned'); END IF;

  prog := public.achievement_progress(prof.id);

  FOR a IN
    SELECT * FROM public.achievements ach
    WHERE NOT EXISTS (
      SELECT 1 FROM public.achievement_claims c WHERE c.user_id = prof.id AND c.slug = ach.slug
    )
    ORDER BY ach.goal
  LOOP
    IF coalesce((prog->>a.metric)::numeric, 0) >= a.goal THEN
      INSERT INTO public.achievement_claims (user_id, slug, reward_xp, reward_sparks)
      VALUES (prof.id, a.slug, a.reward_xp, a.reward_sparks)
      ON CONFLICT (user_id, slug) DO NOTHING;
      total_xp_gain := total_xp_gain + a.reward_xp;
      total_sparks := total_sparks + a.reward_sparks;
      earned := earned || jsonb_build_object('slug', a.slug, 'title', a.title,
        'reward_xp', a.reward_xp, 'reward_sparks', a.reward_sparks);
    END IF;
  END LOOP;

  IF total_xp_gain > 0 OR total_sparks > 0 THEN
    INSERT INTO public.xp_events (user_id, source, amount, label)
    VALUES (prof.id, 'achievement', total_xp_gain, 'Achievements unlocked');

    UPDATE public.profiles
    SET total_xp = total_xp + total_xp_gain,
        sparks = sparks + total_sparks,
        last_active_at = now()
    WHERE id = prof.id
    RETURNING * INTO prof;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'earned', earned, 'gained', total_xp_gain,
    'sparks_gained', total_sparks, 'total_xp', prof.total_xp, 'sparks', prof.sparks, 'progress', prog);
END;
$$;

-- 3. One-time bonuses for study, Pulse Rush and Skyward -----------------------
CREATE TABLE IF NOT EXISTS public.xp_once (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  key text NOT NULL,
  amount integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT ON public.xp_once TO authenticated;
GRANT ALL ON public.xp_once TO service_role;
ALTER TABLE public.xp_once ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own one-time bonuses" ON public.xp_once;
CREATE POLICY "Own one-time bonuses" ON public.xp_once FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.award_bonus_xp(_kind text, _ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  prof public.profiles;
  key text;
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
    -- _ref is the deck slug; pays at 80% then again at 100%, verified from saved progress.
    SELECT coalesce(max(best_percent), 0) INTO n FROM public.study_progress
      WHERE user_id = prof.id AND deck = _ref;
    IF n >= 100 THEN
      key := 'study:' || _ref || ':100'; amount := 350; ok := true;
    ELSIF n >= 80 THEN
      key := 'study:' || _ref || ':80'; amount := 200; ok := true;
    END IF;
  ELSIF _kind = 'pulse_first_clear' THEN
    n := nullif(_ref, '')::integer;
    SELECT count(*) > 0 INTO ok FROM public.game_progress
      WHERE user_id = prof.id AND game = 'pulse' AND level = n AND best_pct >= 100;
    key := 'pulse:first:' || n;
    amount := 90 + least(n, 27) * 10;
  ELSIF _kind = 'skyward_gates' THEN
    n := nullif(_ref, '')::integer;
    IF n NOT IN (25, 50, 100, 150, 200) THEN RETURN jsonb_build_object('status', 'unknown_ref'); END IF;
    SELECT coalesce(max((detail->>'gates')::integer), 0) >= n INTO ok FROM public.game_scores
      WHERE user_id = prof.id AND game = 'skyward' AND detail ? 'gates';
    key := 'skyward:gates:' || n;
    amount := n * 6;
  ELSE
    RETURN jsonb_build_object('status', 'unknown_kind');
  END IF;

  IF NOT ok THEN RETURN jsonb_build_object('status', 'not_earned'); END IF;
  IF EXISTS (SELECT 1 FROM public.xp_once WHERE user_id = prof.id AND key = key) THEN
    RETURN jsonb_build_object('status', 'already_claimed');
  END IF;

  lvl := public.level_from_xp(prof.total_xp);
  gained := greatest(1, round(amount * (1 + (greatest(1, lvl) - 1) * 0.04))::integer);
  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN gained := gained * 2; END IF;
  sparks_gained := greatest(8, gained / 3);

  INSERT INTO public.xp_once (user_id, key, amount) VALUES (prof.id, key, gained)
  ON CONFLICT (user_id, key) DO NOTHING;

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, _kind, gained, key);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      sparks = sparks + sparks_gained,
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object('status', 'awarded', 'gained', gained, 'sparks_gained', sparks_gained,
    'total_xp', prof.total_xp, 'sparks', prof.sparks, 'key', key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_daily_streak() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_achievements() TO authenticated;
GRANT EXECUTE ON FUNCTION public.achievement_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.award_bonus_xp(text, text) TO authenticated;