-- 1. presence ---------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activity_context text;

CREATE OR REPLACE FUNCTION public.touch_presence(_context text DEFAULT NULL)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET last_active_at = now(),
      activity_context = nullif(left(coalesce(_context, ''), 40), '')
  WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.touch_presence(text) TO authenticated;

-- 2. notifications -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_update_own ON public.notifications;
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_on_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient uuid;
  sender_name text;
  sender_handle text;
BEGIN
  SELECT CASE WHEN f.user_a = NEW.sender_id THEN f.user_b ELSE f.user_a END
  INTO recipient
  FROM public.friendships f WHERE f.id = NEW.friendship_id;

  IF recipient IS NULL OR recipient = NEW.sender_id THEN RETURN NEW; END IF;

  SELECT display_name, username INTO sender_name, sender_handle
  FROM public.profiles WHERE id = NEW.sender_id;

  INSERT INTO public.notifications (user_id, actor_id, kind, title, body, link)
  VALUES (
    recipient, NEW.sender_id, 'message',
    coalesce(sender_name, 'Someone') || ' messaged you',
    left(NEW.body, 140),
    '/messages'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_message_notify ON public.messages;
CREATE TRIGGER on_message_notify
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_direct_message();

CREATE OR REPLACE FUNCTION public.notify_on_community_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  community_name text;
BEGIN
  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.user_id;
  SELECT name INTO community_name FROM public.communities WHERE id = NEW.community_id;

  INSERT INTO public.notifications (user_id, actor_id, kind, title, body, link)
  SELECT m.user_id, NEW.user_id, 'community',
         coalesce(sender_name, 'Someone') || ' posted in ' || coalesce(community_name, 'a community'),
         left(NEW.body, 140), '/communities'
  FROM public.community_members m
  WHERE m.community_id = NEW.community_id
    AND m.user_id <> NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = m.user_id AND n.kind = 'community'
        AND n.created_at > now() - interval '2 minutes'
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_community_message_notify ON public.community_messages;
CREATE TRIGGER on_community_message_notify
AFTER INSERT ON public.community_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_on_community_message();

-- 3. shop rotation -----------------------------------------------------------
ALTER TABLE public.cosmetics
  ADD COLUMN IF NOT EXISTS pool text NOT NULL DEFAULT 'core',
  ADD COLUMN IF NOT EXISTS available_until timestamptz;

CREATE OR REPLACE FUNCTION public.purchase_cosmetic(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  item public.cosmetics;
  prof public.profiles;
  lvl integer;
  need integer;
  acc integer := 0;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  SELECT * INTO item FROM public.cosmetics WHERE slug = _slug;
  IF item.slug IS NULL THEN
    RETURN jsonb_build_object('status', 'unknown_item');
  END IF;

  IF item.available_until IS NOT NULL AND item.available_until < now() THEN
    RETURN jsonb_build_object('status', 'expired');
  END IF;

  IF EXISTS (SELECT 1 FROM public.inventory WHERE user_id = prof.id AND cosmetic_slug = _slug) THEN
    RETURN jsonb_build_object('status', 'owned');
  END IF;

  lvl := 1;
  LOOP
    need := round((260 + 180 * power(lvl - 1, 1.32)) / 10) * 10;
    EXIT WHEN acc + need > prof.total_xp OR lvl > 200;
    acc := acc + need;
    lvl := lvl + 1;
  END LOOP;

  IF lvl < item.required_level THEN
    RETURN jsonb_build_object('status', 'locked', 'required_level', item.required_level, 'level', lvl);
  END IF;

  IF prof.sparks < item.price_sparks THEN
    RETURN jsonb_build_object('status', 'insufficient', 'sparks', prof.sparks, 'price', item.price_sparks);
  END IF;

  UPDATE public.profiles SET sparks = sparks - item.price_sparks WHERE id = prof.id RETURNING * INTO prof;
  INSERT INTO public.inventory (user_id, cosmetic_slug) VALUES (prof.id, _slug);

  RETURN jsonb_build_object('status', 'purchased', 'sparks', prof.sparks, 'slug', _slug);
END;
$function$;

-- 4. quests ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quests (
  slug text PRIMARY KEY,
  title text NOT NULL,
  cadence text NOT NULL,
  source text NOT NULL,
  goal integer NOT NULL DEFAULT 1,
  reward_xp integer NOT NULL DEFAULT 100,
  reward_sparks integer NOT NULL DEFAULT 25,
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.quests TO authenticated, anon;
GRANT ALL ON public.quests TO service_role;
ALTER TABLE public.quests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quests_select_everyone ON public.quests;
CREATE POLICY quests_select_everyone ON public.quests
  FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE IF NOT EXISTS public.quest_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quest_slug text NOT NULL REFERENCES public.quests(slug) ON DELETE CASCADE,
  period_key text NOT NULL,
  reward_xp integer NOT NULL DEFAULT 0,
  reward_sparks integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, quest_slug, period_key)
);

GRANT SELECT ON public.quest_claims TO authenticated;
GRANT ALL ON public.quest_claims TO service_role;
ALTER TABLE public.quest_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quest_claims_select_own ON public.quest_claims;
CREATE POLICY quest_claims_select_own ON public.quest_claims
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.claim_quest(_slug text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q public.quests;
  prof public.profiles;
  window_len interval;
  period text;
  progress integer;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(prof.id) THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  SELECT * INTO q FROM public.quests WHERE slug = _slug;
  IF q.slug IS NULL THEN RETURN jsonb_build_object('status', 'unknown_quest'); END IF;

  IF q.cadence = 'daily' THEN
    window_len := interval '1 day';
    period := to_char(now() AT TIME ZONE 'UTC', 'IYYY-MM-DD');
  ELSE
    window_len := interval '7 days';
    period := to_char(now() AT TIME ZONE 'UTC', 'IYYY-"W"IW');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quest_claims c
    WHERE c.user_id = prof.id AND c.quest_slug = _slug AND c.period_key = period
  ) THEN
    RETURN jsonb_build_object('status', 'claimed');
  END IF;

  SELECT count(*) INTO progress FROM public.xp_events e
  WHERE e.user_id = prof.id AND e.source = q.source AND e.created_at > now() - window_len;

  IF progress < q.goal THEN
    RETURN jsonb_build_object('status', 'incomplete', 'progress', progress, 'goal', q.goal);
  END IF;

  INSERT INTO public.quest_claims (user_id, quest_slug, period_key, reward_xp, reward_sparks)
  VALUES (prof.id, _slug, period, q.reward_xp, q.reward_sparks);

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, 'quest', q.reward_xp, q.title);

  UPDATE public.profiles
  SET total_xp = total_xp + q.reward_xp,
      sparks = sparks + q.reward_sparks,
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object(
    'status', 'claimed_now',
    'reward_xp', q.reward_xp,
    'reward_sparks', q.reward_sparks,
    'total_xp', prof.total_xp,
    'sparks', prof.sparks
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_quest(text) TO authenticated;