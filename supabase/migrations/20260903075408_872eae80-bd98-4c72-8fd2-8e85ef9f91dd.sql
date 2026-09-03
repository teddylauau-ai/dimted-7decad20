-- ============ private communities ============
ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public';

DO $$ BEGIN
  ALTER TABLE public.communities ADD CONSTRAINT communities_visibility_check
    CHECK (visibility IN ('public', 'private'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.community_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid NOT NULL REFERENCES public.communities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (community_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.community_invites TO authenticated;
GRANT ALL ON public.community_invites TO service_role;
ALTER TABLE public.community_invites ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_community_manager(_community_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.communities c WHERE c.id = _community_id AND c.owner_id = _user_id)
      OR EXISTS (SELECT 1 FROM public.community_members m
                 WHERE m.community_id = _community_id AND m.user_id = _user_id AND m.role IN ('owner','admin'))
      OR public.is_staff(_user_id)
$$;

CREATE OR REPLACE FUNCTION public.can_see_community(_community_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = _community_id
      AND (
        c.visibility = 'public'
        OR c.owner_id = _user_id
        OR public.is_community_member(c.id, _user_id)
        OR EXISTS (SELECT 1 FROM public.community_invites i WHERE i.community_id = c.id AND i.user_id = _user_id)
        OR public.is_staff(_user_id)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_join_community(_community_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = _community_id
      AND (
        c.visibility = 'public'
        OR c.owner_id = _user_id
        OR EXISTS (SELECT 1 FROM public.community_invites i WHERE i.community_id = c.id AND i.user_id = _user_id)
        OR public.is_staff(_user_id)
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_community_manager(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_see_community(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_join_community(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS community_invites_select ON public.community_invites;
CREATE POLICY community_invites_select ON public.community_invites FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_community_manager(community_id, auth.uid()));

DROP POLICY IF EXISTS community_invites_insert ON public.community_invites;
CREATE POLICY community_invites_insert ON public.community_invites FOR INSERT TO authenticated
  WITH CHECK (public.is_community_manager(community_id, auth.uid()) AND invited_by = auth.uid());

DROP POLICY IF EXISTS community_invites_delete ON public.community_invites;
CREATE POLICY community_invites_delete ON public.community_invites FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_community_manager(community_id, auth.uid()));

DROP POLICY IF EXISTS communities_select_all_signed_in ON public.communities;
CREATE POLICY communities_select_visible ON public.communities FOR SELECT TO authenticated
  USING (public.can_see_community(id, auth.uid()));

DROP POLICY IF EXISTS communities_update_owner ON public.communities;
CREATE POLICY communities_update_manage ON public.communities FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.my_rank() >= 30)
  WITH CHECK (owner_id = auth.uid() OR public.my_rank() >= 30);

DROP POLICY IF EXISTS communities_delete_owner ON public.communities;
CREATE POLICY communities_delete_manage ON public.communities FOR DELETE TO authenticated
  USING (owner_id = auth.uid() OR public.my_rank() >= 30);

DROP POLICY IF EXISTS community_members_join_self ON public.community_members;
CREATE POLICY community_members_join ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND public.can_join_community(community_id, auth.uid()))
    OR public.is_community_manager(community_id, auth.uid())
  );

DROP POLICY IF EXISTS community_members_leave_self ON public.community_members;
CREATE POLICY community_members_leave ON public.community_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_community_manager(community_id, auth.uid()));

DROP POLICY IF EXISTS community_members_select_signed_in ON public.community_members;
CREATE POLICY community_members_select_visible ON public.community_members FOR SELECT TO authenticated
  USING (public.can_see_community(community_id, auth.uid()));

-- ============ deleting messages ============
DROP POLICY IF EXISTS messages_delete_own_or_staff ON public.messages;
CREATE POLICY messages_delete_own_or_staff ON public.messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid() OR public.my_rank() >= 20);

DROP POLICY IF EXISTS community_messages_delete_own_or_staff ON public.community_messages;
CREATE POLICY community_messages_delete_own_or_staff ON public.community_messages FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.my_rank() >= 20
    OR public.is_community_manager(community_id, auth.uid())
  );

-- owner outranks everyone: rewrite mod delete to allow owner regardless of target rank
CREATE OR REPLACE FUNCTION public.mod_delete_message(_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mine integer := public.my_rank();
  owner_id uuid;
BEGIN
  IF mine < 20 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  SELECT user_id INTO owner_id FROM public.community_messages WHERE id = _message_id;
  IF owner_id IS NULL THEN RETURN jsonb_build_object('status', 'no_target'); END IF;
  IF mine < 40 AND public.role_rank(coalesce(public.top_role(owner_id), 'member'::app_role)) >= mine THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  DELETE FROM public.community_messages WHERE id = _message_id;
  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), owner_id, 'delete_message', jsonb_build_object('message_id', _message_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.mod_delete_dm(_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mine integer := public.my_rank();
  owner_id uuid;
BEGIN
  IF mine < 20 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  SELECT sender_id INTO owner_id FROM public.messages WHERE id = _message_id;
  IF owner_id IS NULL THEN RETURN jsonb_build_object('status', 'no_target'); END IF;
  IF mine < 40 AND public.role_rank(coalesce(public.top_role(owner_id), 'member'::app_role)) >= mine THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  DELETE FROM public.messages WHERE id = _message_id;
  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), owner_id, 'delete_dm', jsonb_build_object('message_id', _message_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.mod_delete_dm(uuid) TO authenticated;

-- ============ owner: nuke a community / an account ============
CREATE OR REPLACE FUNCTION public.owner_delete_community(_community_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.my_rank() < 30 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  DELETE FROM public.community_messages WHERE community_id = _community_id;
  DELETE FROM public.channels WHERE community_id = _community_id;
  DELETE FROM public.community_members WHERE community_id = _community_id;
  DELETE FROM public.community_invites WHERE community_id = _community_id;
  DELETE FROM public.communities WHERE id = _community_id;
  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), NULL, 'delete_community', jsonb_build_object('community_id', _community_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_delete_account(_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cid uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  IF _user_id = auth.uid() THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  FOR cid IN SELECT id FROM public.communities WHERE owner_id = _user_id LOOP
    DELETE FROM public.community_messages WHERE community_id = cid;
    DELETE FROM public.channels WHERE community_id = cid;
    DELETE FROM public.community_members WHERE community_id = cid;
    DELETE FROM public.community_invites WHERE community_id = cid;
    DELETE FROM public.communities WHERE id = cid;
  END LOOP;

  DELETE FROM public.community_messages WHERE user_id = _user_id;
  DELETE FROM public.community_members WHERE user_id = _user_id;
  DELETE FROM public.community_invites WHERE user_id = _user_id OR invited_by = _user_id;
  DELETE FROM public.messages WHERE sender_id = _user_id;
  DELETE FROM public.messages WHERE friendship_id IN (
    SELECT id FROM public.friendships WHERE user_a = _user_id OR user_b = _user_id
  );
  DELETE FROM public.friendships WHERE user_a = _user_id OR user_b = _user_id OR requester_id = _user_id;
  DELETE FROM public.notifications WHERE user_id = _user_id OR actor_id = _user_id;
  DELETE FROM public.inventory WHERE user_id = _user_id;
  DELETE FROM public.xp_events WHERE user_id = _user_id;
  DELETE FROM public.quest_claims WHERE user_id = _user_id;
  DELETE FROM public.game_scores WHERE user_id = _user_id;
  DELETE FROM public.game_progress WHERE user_id = _user_id;
  DELETE FROM public.study_progress WHERE user_id = _user_id;
  DELETE FROM public.user_roles WHERE user_id = _user_id OR granted_by = _user_id;
  DELETE FROM public.staff_actions WHERE actor_id = _user_id OR target_id = _user_id;
  UPDATE public.profiles SET sanctioned_by = NULL WHERE sanctioned_by = _user_id;
  DELETE FROM public.profiles WHERE id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), NULL, 'delete_account', jsonb_build_object('user_id', _user_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;

GRANT EXECUTE ON FUNCTION public.owner_delete_community(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_delete_account(uuid) TO authenticated;

-- ============ Nova Vanguard ============
CREATE TABLE IF NOT EXISTS public.vanguard_items (
  slug text PRIMARY KEY,
  kind text NOT NULL,
  name text NOT NULL,
  description text NOT NULL,
  price_cores integer NOT NULL DEFAULT 0,
  required_level integer NOT NULL DEFAULT 1,
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vanguard_items TO authenticated;
GRANT ALL ON public.vanguard_items TO service_role;
ALTER TABLE public.vanguard_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vanguard_items_read ON public.vanguard_items;
CREATE POLICY vanguard_items_read ON public.vanguard_items FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.game_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  game text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game, slug)
);
GRANT SELECT ON public.game_unlocks TO authenticated;
GRANT ALL ON public.game_unlocks TO service_role;
ALTER TABLE public.game_unlocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS game_unlocks_select_own ON public.game_unlocks;
CREATE POLICY game_unlocks_select_own ON public.game_unlocks FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.my_rank() >= 30);

CREATE TABLE IF NOT EXISTS public.vanguard_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cores integer NOT NULL DEFAULT 0,
  equipped_weapon text NOT NULL DEFAULT 'pulse-rifle',
  equipped_gear text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vanguard_state TO authenticated;
GRANT ALL ON public.vanguard_state TO service_role;
ALTER TABLE public.vanguard_state ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vanguard_state_select_own ON public.vanguard_state;
CREATE POLICY vanguard_state_select_own ON public.vanguard_state FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.my_rank() >= 30);

DROP TRIGGER IF EXISTS vanguard_state_updated_at ON public.vanguard_state;
CREATE TRIGGER vanguard_state_updated_at BEFORE UPDATE ON public.vanguard_state
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

INSERT INTO public.vanguard_items (slug, kind, name, description, price_cores, required_level, rarity) VALUES
  ('pulse-rifle',   'weapon', 'Pulse Rifle',    'Reliable rapid single shot. Always yours.',                     0,   1, 'common'),
  ('scatter-coil',  'weapon', 'Scatter Coil',   'Three-shot spread. Shreds anything up close.',                 120, 1, 'uncommon'),
  ('arc-lance',     'weapon', 'Arc Lance',      'Piercing beam bolt that punches through a whole line.',        260, 1, 'rare'),
  ('nova-cannon',   'weapon', 'Nova Cannon',    'Slow charge, huge blast radius.',                              520, 1, 'epic'),
  ('void-ribbon',   'weapon', 'Void Ribbon',    'Homing ribbons that curve into whatever is nearest.',          900, 1, 'legendary'),
  ('dash-core',     'gear',   'Dash Core',      'Adds a burst dash that passes through bullets.',               150, 1, 'uncommon'),
  ('kinetic-plate', 'gear',   'Kinetic Plate',  'One extra hit point every run.',                               220, 1, 'rare'),
  ('magnet-field',  'gear',   'Magnet Field',   'Cores and drops fly to you from across the room.',             180, 1, 'uncommon'),
  ('phase-boots',   'gear',   'Phase Boots',    'Double jump, and a shorter fall.',                             400, 1, 'epic'),
  ('siphon-lattice','gear',   'Siphon Lattice', 'Every tenth kill stitches a hit point back on.',               600, 1, 'legendary')
ON CONFLICT (slug) DO NOTHING;

CREATE OR REPLACE FUNCTION public.vanguard_state_for_me()
RETURNS public.vanguard_state LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st public.vanguard_state;
BEGIN
  SELECT * INTO st FROM public.vanguard_state WHERE user_id = auth.uid();
  IF st.user_id IS NULL AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.vanguard_state (user_id) VALUES (auth.uid())
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO st FROM public.vanguard_state WHERE user_id = auth.uid();
  END IF;
  RETURN st;
END;
$$;

CREATE OR REPLACE FUNCTION public.vanguard_finish(_level integer, _time_ms integer, _stars integer, _cores integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  st public.vanguard_state;
  lvl integer := greatest(1, least(coalesce(_level, 1), 24));
  stars integer := greatest(0, least(coalesce(_stars, 0), 3));
  cores integer := greatest(0, least(coalesce(_cores, 0), 400));
  ms integer := greatest(0, least(coalesce(_time_ms, 0), 3600000));
  prev public.game_progress;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  IF public.is_banned(auth.uid()) THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  st := public.vanguard_state_for_me();

  SELECT * INTO prev FROM public.game_progress
  WHERE user_id = auth.uid() AND game = 'nova-vanguard' ORDER BY level DESC LIMIT 1;

  INSERT INTO public.game_progress (user_id, game, level, stars, best_ms)
  VALUES (auth.uid(), 'nova-vanguard', lvl, stars, ms)
  ON CONFLICT DO NOTHING;

  UPDATE public.vanguard_state
  SET cores = cores + vanguard_finish.cores
  WHERE user_id = auth.uid()
  RETURNING * INTO st;

  RETURN jsonb_build_object('status', 'ok', 'cores', st.cores, 'gained_cores', cores, 'level', lvl, 'stars', stars);
END;
$$;

CREATE OR REPLACE FUNCTION public.vanguard_unlock(_slug text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  item public.vanguard_items;
  st public.vanguard_state;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  SELECT * INTO item FROM public.vanguard_items WHERE slug = _slug;
  IF item.slug IS NULL THEN RETURN jsonb_build_object('status', 'unknown_item'); END IF;

  st := public.vanguard_state_for_me();

  IF EXISTS (SELECT 1 FROM public.game_unlocks WHERE user_id = auth.uid() AND game = 'nova-vanguard' AND slug = _slug) THEN
    RETURN jsonb_build_object('status', 'owned');
  END IF;
  IF st.cores < item.price_cores THEN
    RETURN jsonb_build_object('status', 'insufficient', 'cores', st.cores, 'price', item.price_cores);
  END IF;

  INSERT INTO public.game_unlocks (user_id, game, slug) VALUES (auth.uid(), 'nova-vanguard', _slug)
  ON CONFLICT DO NOTHING;
  UPDATE public.vanguard_state SET cores = cores - item.price_cores WHERE user_id = auth.uid()
  RETURNING * INTO st;

  RETURN jsonb_build_object('status', 'unlocked', 'cores', st.cores, 'slug', _slug);
END;
$$;

CREATE OR REPLACE FUNCTION public.vanguard_equip(_weapon text, _gear text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE st public.vanguard_state;
BEGIN
  IF auth.uid() IS NULL THEN RETURN jsonb_build_object('status', 'no_profile'); END IF;
  st := public.vanguard_state_for_me();

  IF _weapon IS NOT NULL AND _weapon <> 'pulse-rifle'
     AND NOT EXISTS (SELECT 1 FROM public.game_unlocks WHERE user_id = auth.uid() AND game = 'nova-vanguard' AND slug = _weapon) THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;
  IF _gear IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.game_unlocks WHERE user_id = auth.uid() AND game = 'nova-vanguard' AND slug = _gear) THEN
    RETURN jsonb_build_object('status', 'not_owned');
  END IF;

  UPDATE public.vanguard_state
  SET equipped_weapon = coalesce(_weapon, equipped_weapon),
      equipped_gear = _gear
  WHERE user_id = auth.uid()
  RETURNING * INTO st;

  RETURN jsonb_build_object('status', 'equipped', 'weapon', st.equipped_weapon, 'gear', st.equipped_gear);
END;
$$;

GRANT EXECUTE ON FUNCTION public.vanguard_state_for_me() TO authenticated;
GRANT EXECUTE ON FUNCTION public.vanguard_finish(integer, integer, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vanguard_unlock(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vanguard_equip(text, text) TO authenticated;

-- arcade XP allows the new game
CREATE OR REPLACE FUNCTION public.award_arcade_xp(_game text, _score integer)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    'nova-rift', 'revision-quiz', 'nova-vanguard'
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

  IF runs_today >= 24 THEN
    RETURN jsonb_build_object('status', 'capped', 'total_xp', prof.total_xp, 'sparks', prof.sparks, 'runs_left', 0);
  END IF;

  SELECT coalesce(max(score), 0) INTO best FROM public.game_scores
  WHERE user_id = prof.id AND game = _game;
  IF score_clamped > best THEN is_best := true; END IF;

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
    'runs_left', 23 - runs_today,
    'total_xp', prof.total_xp,
    'sparks', prof.sparks,
    'energy', prof.energy
  );
END;
$function$;