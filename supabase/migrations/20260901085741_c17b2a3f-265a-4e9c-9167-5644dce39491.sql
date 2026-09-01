-- PROFILES
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL,
  bio text,
  title text NOT NULL DEFAULT 'Newcomer',
  total_xp integer NOT NULL DEFAULT 0,
  energy integer NOT NULL DEFAULT 0,
  surge_until timestamptz,
  streak integer NOT NULL DEFAULT 0,
  realm_name text NOT NULL DEFAULT 'Unnamed Realm',
  last_active_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_signed_in" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base text;
  candidate text;
  n integer := 0;
BEGIN
  base := lower(regexp_replace(coalesce(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'player'), '[^a-z0-9_]', '', 'g'));
  IF length(base) < 3 THEN base := 'player'; END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.profiles p WHERE p.username = candidate) LOOP
    n := n + 1;
    candidate := base || n::text;
  END LOOP;

  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    candidate,
    coalesce(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', candidate)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- FRIENDSHIPS
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  friendship_xp integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_exchange_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_ordered CHECK (user_a < user_b),
  CONSTRAINT friendships_status_valid CHECK (status IN ('pending', 'accepted')),
  CONSTRAINT friendships_unique UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "friendships_select_participants" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "friendships_insert_requester" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid() AND auth.uid() IN (user_a, user_b));
CREATE POLICY "friendships_update_participants" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() IN (user_a, user_b)) WITH CHECK (auth.uid() IN (user_a, user_b));
CREATE POLICY "friendships_delete_participants" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() IN (user_a, user_b));

CREATE OR REPLACE FUNCTION public.is_friendship_member(_friendship_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.id = _friendship_id AND _user_id IN (f.user_a, f.user_b)
  );
$$;

-- DIRECT MESSAGES
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  friendship_id uuid NOT NULL REFERENCES public.friendships(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_friendship_created_idx ON public.messages (friendship_id, created_at);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_members" ON public.messages FOR SELECT TO authenticated
  USING (public.is_friendship_member(friendship_id, auth.uid()));
CREATE POLICY "messages_insert_members" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_friendship_member(friendship_id, auth.uid()));

-- COMMUNITIES
CREATE TABLE public.communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  tagline text,
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_xp integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.communities TO authenticated;
GRANT ALL ON public.communities TO service_role;
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "communities_select_all_signed_in" ON public.communities FOR SELECT TO authenticated USING (true);
CREATE POLICY "communities_insert_owner" ON public.communities FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "communities_update_owner" ON public.communities FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "communities_delete_owner" ON public.communities FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE public.community_members (
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.community_members TO authenticated;
GRANT ALL ON public.community_members TO service_role;
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_members_select_signed_in" ON public.community_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "community_members_join_self" ON public.community_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "community_members_leave_self" ON public.community_members FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_community_member(_community_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.community_members m
    WHERE m.community_id = _community_id AND m.user_id = _user_id
  );
$$;

CREATE TABLE public.channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  name text NOT NULL,
  topic text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT channels_unique_name UNIQUE (community_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels TO authenticated;
GRANT ALL ON public.channels TO service_role;
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels_select_signed_in" ON public.channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "channels_write_owner" ON public.channels FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.owner_id = auth.uid()));

CREATE TABLE public.community_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX community_messages_channel_idx ON public.community_messages (channel_id, created_at);
GRANT SELECT, INSERT ON public.community_messages TO authenticated;
GRANT ALL ON public.community_messages TO service_role;
ALTER TABLE public.community_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "community_messages_select_members" ON public.community_messages FOR SELECT TO authenticated
  USING (public.is_community_member(community_id, auth.uid()));
CREATE POLICY "community_messages_insert_members" ON public.community_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_community_member(community_id, auth.uid()));

-- XP LOG
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL,
  amount integer NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_created_idx ON public.xp_events (user_id, created_at DESC);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_events_select_self_or_friends" ON public.xp_events FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.friendships f
      WHERE f.status = 'accepted'
        AND ((f.user_a = auth.uid() AND f.user_b = xp_events.user_id)
          OR (f.user_b = auth.uid() AND f.user_a = xp_events.user_id))
    )
  );

-- AWARD XP (cooldown-enforced, surge-aware)
CREATE OR REPLACE FUNCTION public.award_xp(_source text, _label text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base integer;
  cooldown interval;
  cap integer;
  window_len interval;
  recent integer;
  multiplier integer := 1;
  gained integer;
  prof public.profiles;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN
    RETURN jsonb_build_object('status', 'no_profile');
  END IF;

  CASE _source
    WHEN 'message' THEN base := 4; cooldown := interval '60 seconds'; cap := 15; window_len := interval '1 hour';
    WHEN 'conversation' THEN base := 40; cooldown := interval '10 minutes'; cap := 3; window_len := interval '1 day';
    WHEN 'community' THEN base := 60; cooldown := interval '5 minutes'; cap := 5; window_len := interval '1 day';
    WHEN 'friend' THEN base := 120; cooldown := interval '1 minute'; cap := 5; window_len := interval '7 days';
    WHEN 'activity' THEN base := 100; cooldown := interval '1 minute'; cap := 4; window_len := interval '1 day';
    WHEN 'challenge' THEN base := 150; cooldown := interval '0 seconds'; cap := 6; window_len := interval '1 day';
    WHEN 'discovery' THEN base := 80; cooldown := interval '30 seconds'; cap := 6; window_len := interval '1 day';
    ELSE RETURN jsonb_build_object('status', 'unknown_source');
  END CASE;

  IF cooldown > interval '0 seconds' AND EXISTS (
    SELECT 1 FROM public.xp_events e
    WHERE e.user_id = prof.id AND e.source = _source AND e.created_at > now() - cooldown
  ) THEN
    RETURN jsonb_build_object('status', 'cooldown', 'total_xp', prof.total_xp, 'energy', prof.energy);
  END IF;

  SELECT count(*) INTO recent FROM public.xp_events e
  WHERE e.user_id = prof.id AND e.source = _source AND e.created_at > now() - window_len;

  IF recent >= cap THEN
    RETURN jsonb_build_object('status', 'capped', 'total_xp', prof.total_xp, 'energy', prof.energy);
  END IF;

  IF prof.surge_until IS NOT NULL AND prof.surge_until > now() THEN
    multiplier := 2;
  END IF;
  gained := base * multiplier;

  INSERT INTO public.xp_events (user_id, source, amount, label)
  VALUES (prof.id, _source, gained, _label);

  UPDATE public.profiles
  SET total_xp = total_xp + gained,
      energy = least(100, energy + greatest(1, (gained / 12))),
      last_active_at = now()
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object(
    'status', 'granted',
    'gained', gained,
    'total_xp', prof.total_xp,
    'energy', prof.energy,
    'surge_until', prof.surge_until
  );
END;
$$;

-- ENERGY SURGE
CREATE OR REPLACE FUNCTION public.ignite_surge()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof public.profiles;
BEGIN
  SELECT * INTO prof FROM public.profiles WHERE id = auth.uid();
  IF prof.id IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF prof.energy < 100 THEN
    RETURN jsonb_build_object('status', 'not_ready', 'energy', prof.energy);
  END IF;

  UPDATE public.profiles
  SET energy = 0, surge_until = now() + interval '30 minutes'
  WHERE id = prof.id
  RETURNING * INTO prof;

  RETURN jsonb_build_object('status', 'ignited', 'energy', prof.energy, 'surge_until', prof.surge_until);
END;
$$;

-- FRIENDSHIP XP on message exchange
CREATE OR REPLACE FUNCTION public.bump_friendship_on_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.friendships
  SET friendship_xp = friendship_xp + 10,
      last_exchange_at = now()
  WHERE id = NEW.friendship_id
    AND (last_exchange_at IS NULL OR last_exchange_at < now() - interval '30 seconds');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_created
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.bump_friendship_on_message();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.community_messages;