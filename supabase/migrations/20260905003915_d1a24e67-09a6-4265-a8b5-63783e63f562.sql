-- 1. Message reactions (works for both DMs and community channel posts)
CREATE TABLE public.message_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dm_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  community_message_id uuid REFERENCES public.community_messages(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_reactions_one_target CHECK (num_nonnulls(dm_message_id, community_message_id) = 1)
);
CREATE UNIQUE INDEX message_reactions_dm_unique
  ON public.message_reactions (user_id, dm_message_id, emoji) WHERE dm_message_id IS NOT NULL;
CREATE UNIQUE INDEX message_reactions_community_unique
  ON public.message_reactions (user_id, community_message_id, emoji) WHERE community_message_id IS NOT NULL;

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions are visible inside their conversation"
ON public.message_reactions FOR SELECT TO authenticated
USING (
  (dm_message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = dm_message_id AND public.is_friendship_member(m.friendship_id, auth.uid())
  ))
  OR
  (community_message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.community_messages cm
    WHERE cm.id = community_message_id AND public.is_community_member(cm.community_id, auth.uid())
  ))
);

CREATE POLICY "Members can react in their own conversations"
ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    (dm_message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = dm_message_id AND public.is_friendship_member(m.friendship_id, auth.uid())
    ))
    OR
    (community_message_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.community_messages cm
      WHERE cm.id = community_message_id AND public.is_community_member(cm.community_id, auth.uid())
    ))
  )
);

CREATE POLICY "You can remove your own reactions"
ON public.message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 2. Pulse Rush daily challenge: +50 coins once per UTC day for clearing the daily level
DROP FUNCTION public.pulse_finish(integer, integer, integer, integer, boolean);
CREATE OR REPLACE FUNCTION public.pulse_finish(
  _level integer, _pct integer, _time_ms integer, _coins integer,
  _practice boolean DEFAULT false, _daily boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  st public.pulse_state;
  lvl integer := greatest(1, least(coalesce(_level, 1), 30));
  pct integer := greatest(0, least(coalesce(_pct, 0), 100));
  ms integer := greatest(0, least(coalesce(_time_ms, 0), 3600000));
  coin_mask integer := greatest(0, least(coalesce(_coins, 0), 7));
  existing public.game_progress;
  new_coins integer := 0;
  reward integer := 0;
  daily_bonus integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(auth.uid()) THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  st := public.pulse_state_for_me();

  IF coalesce(_practice, false) THEN
    RETURN jsonb_build_object('status', 'practice', 'coins', st.coins);
  END IF;

  SELECT * INTO existing FROM public.game_progress
  WHERE user_id = auth.uid() AND game = 'pulse-rush' AND level = lvl LIMIT 1;

  IF existing.id IS NULL THEN
    new_coins := (coin_mask & 1) + ((coin_mask >> 1) & 1) + ((coin_mask >> 2) & 1);
    INSERT INTO public.game_progress (user_id, game, level, stars, best_ms, best_pct, coins, attempts)
    VALUES (auth.uid(), 'pulse-rush', lvl,
            CASE WHEN pct >= 100 THEN 1 ELSE 0 END,
            CASE WHEN pct >= 100 THEN ms ELSE NULL END,
            pct, coin_mask, 1);
    reward := CASE WHEN pct >= 100 THEN 120 + lvl * 20
                   ELSE greatest(2, pct / 2)
              END + new_coins * 45;
  ELSE
    new_coins := ((coin_mask & ~existing.coins) & 1)
               + (((coin_mask & ~existing.coins) >> 1) & 1)
               + (((coin_mask & ~existing.coins) >> 2) & 1);
    reward := CASE
                WHEN pct >= 100 AND coalesce(existing.best_pct, 0) < 100 THEN 120 + lvl * 20
                WHEN pct >= 100 THEN 15 + lvl * 2
                WHEN pct > coalesce(existing.best_pct, 0) THEN greatest(3, (pct - existing.best_pct) * 2)
                ELSE 0
              END + new_coins * 45;
    UPDATE public.game_progress
    SET best_pct = greatest(coalesce(existing.best_pct, 0), pct),
        coins = existing.coins | coin_mask,
        stars = greatest(coalesce(existing.stars, 0), CASE WHEN pct >= 100 THEN 1 ELSE 0 END),
        attempts = coalesce(existing.attempts, 0) + 1,
        best_ms = CASE WHEN pct >= 100 THEN least(coalesce(existing.best_ms, ms), ms) ELSE existing.best_ms END
    WHERE id = existing.id;
  END IF;

  -- Daily challenge: one 50-coin bonus per UTC day for clearing the daily level.
  IF coalesce(_daily, false) AND pct >= 100 THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.game_scores
      WHERE user_id = auth.uid() AND game = 'pulse-daily'
        AND created_at >= date_trunc('day', now())
    ) THEN
      daily_bonus := 50;
      INSERT INTO public.game_scores (user_id, game, score, detail)
      VALUES (auth.uid(), 'pulse-daily', lvl, jsonb_build_object('day', to_char(now(), 'YYYY-MM-DD'), 'level', lvl));
    END IF;
  END IF;

  IF reward + daily_bonus > 0 THEN
    UPDATE public.pulse_state SET coins = coins + reward + daily_bonus WHERE user_id = auth.uid() RETURNING * INTO st;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'coins', st.coins, 'gained', reward,
                            'daily_bonus', daily_bonus,
                            'level', lvl, 'pct', pct, 'new_coins', new_coins);
END;
$function$;

-- 3. Armory collection milestones: one-time XP/Sparks for collection size
CREATE OR REPLACE FUNCTION public.claim_armory_milestone(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  q public.quests;
  have integer;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(auth.uid()) THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  SELECT * INTO q FROM public.quests WHERE slug = _slug AND cadence = 'milestone';
  IF NOT FOUND THEN RETURN jsonb_build_object('status', 'unknown_quest'); END IF;

  IF EXISTS (
    SELECT 1 FROM public.quest_claims
    WHERE user_id = auth.uid() AND quest_slug = _slug AND period_key = 'ever'
  ) THEN
    RETURN jsonb_build_object('status', 'claimed');
  END IF;

  SELECT count(*) INTO have FROM public.inventory WHERE user_id = auth.uid();
  IF have < q.goal THEN
    RETURN jsonb_build_object('status', 'incomplete', 'progress', have, 'goal', q.goal);
  END IF;

  INSERT INTO public.quest_claims (user_id, quest_slug, period_key, reward_xp, reward_sparks)
  VALUES (auth.uid(), _slug, 'ever', q.reward_xp, q.reward_sparks);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (auth.uid(), 'armory', q.reward_xp, q.title);

  UPDATE public.profiles
  SET total_xp = total_xp + q.reward_xp,
      sparks = sparks + q.reward_sparks
  WHERE id = auth.uid();

  RETURN jsonb_build_object('status', 'claimed_now', 'reward_xp', q.reward_xp,
                            'reward_sparks', q.reward_sparks, 'progress', have, 'goal', q.goal);
END;
$function$;