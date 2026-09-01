-- ============ Ban / mute state ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS banned_until timestamptz,
  ADD COLUMN IF NOT EXISTS ban_reason text,
  ADD COLUMN IF NOT EXISTS muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS mute_reason text,
  ADD COLUMN IF NOT EXISTS sanctioned_by uuid;

CREATE OR REPLACE FUNCTION public.is_banned(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.banned_until IS NOT NULL AND p.banned_until > now()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_muted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id AND p.muted_until IS NOT NULL AND p.muted_until > now()
  )
$$;

-- ============ Sanctions ============
CREATE OR REPLACE FUNCTION public.mod_set_mute(_user_id uuid, _minutes integer, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mine integer := public.my_rank();
  theirs integer;
  until timestamptz;
BEGIN
  IF mine < 20 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;
  theirs := public.role_rank(coalesce(public.top_role(_user_id), 'member'::app_role));
  IF theirs >= mine THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  IF coalesce(_minutes, 0) <= 0 THEN
    until := NULL;
  ELSE
    -- moderators cap at 24h, admins and owner are uncapped
    IF mine = 20 THEN _minutes := least(_minutes, 1440); END IF;
    until := now() + make_interval(mins => _minutes);
  END IF;

  UPDATE public.profiles
  SET muted_until = until,
      mute_reason = CASE WHEN until IS NULL THEN NULL ELSE _reason END,
      sanctioned_by = CASE WHEN until IS NULL THEN sanctioned_by ELSE auth.uid() END
  WHERE id = _user_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, CASE WHEN until IS NULL THEN 'unmute' ELSE 'mute' END,
          jsonb_build_object('minutes', _minutes, 'reason', _reason));

  RETURN jsonb_build_object('status', 'ok', 'muted_until', until);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_ban(_user_id uuid, _minutes integer, _reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mine integer := public.my_rank();
  theirs integer;
  until timestamptz;
BEGIN
  IF mine < 30 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  IF _user_id = auth.uid() THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;
  theirs := public.role_rank(coalesce(public.top_role(_user_id), 'member'::app_role));
  IF theirs >= mine THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;

  IF _minutes IS NULL OR _minutes = 0 THEN
    until := NULL;
  ELSIF _minutes < 0 THEN
    until := now() + interval '100 years';
  ELSE
    until := now() + make_interval(mins => _minutes);
  END IF;

  UPDATE public.profiles
  SET banned_until = until,
      ban_reason = CASE WHEN until IS NULL THEN NULL ELSE _reason END,
      sanctioned_by = CASE WHEN until IS NULL THEN sanctioned_by ELSE auth.uid() END
  WHERE id = _user_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, CASE WHEN until IS NULL THEN 'unban' ELSE 'ban' END,
          jsonb_build_object('minutes', _minutes, 'reason', _reason));

  RETURN jsonb_build_object('status', 'ok', 'banned_until', until);
END;
$$;

CREATE OR REPLACE FUNCTION public.mod_delete_message(_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  mine integer := public.my_rank();
  owner_id uuid;
BEGIN
  IF mine < 20 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  SELECT user_id INTO owner_id FROM public.community_messages WHERE id = _message_id;
  IF owner_id IS NULL THEN RETURN jsonb_build_object('status', 'no_target'); END IF;
  IF public.role_rank(coalesce(public.top_role(owner_id), 'member'::app_role)) >= mine THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;

  DELETE FROM public.community_messages WHERE id = _message_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), owner_id, 'delete_message', jsonb_build_object('message_id', _message_id));

  RETURN jsonb_build_object('status', 'ok');
END;
$$;

-- ============ Owner: edit anything on any account ============
CREATE OR REPLACE FUNCTION public.owner_edit_profile(_user_id uuid, _patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prof public.profiles;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  UPDATE public.profiles p SET
    display_name      = coalesce(nullif(_patch->>'display_name', ''), p.display_name),
    username          = coalesce(nullif(_patch->>'username', ''), p.username),
    bio               = CASE WHEN _patch ? 'bio' THEN _patch->>'bio' ELSE p.bio END,
    title             = coalesce(nullif(_patch->>'title', ''), p.title),
    realm_name        = coalesce(nullif(_patch->>'realm_name', ''), p.realm_name),
    avatar_url        = CASE WHEN _patch ? 'avatar_url' THEN nullif(_patch->>'avatar_url', '') ELSE p.avatar_url END,
    total_xp          = CASE WHEN _patch ? 'total_xp' THEN greatest(0, (_patch->>'total_xp')::integer) ELSE p.total_xp END,
    sparks            = CASE WHEN _patch ? 'sparks' THEN greatest(0, (_patch->>'sparks')::integer) ELSE p.sparks END,
    energy            = CASE WHEN _patch ? 'energy' THEN least(100, greatest(0, (_patch->>'energy')::integer)) ELSE p.energy END,
    streak            = CASE WHEN _patch ? 'streak' THEN greatest(0, (_patch->>'streak')::integer) ELSE p.streak END,
    equipped_nametag  = CASE WHEN _patch ? 'equipped_nametag' THEN nullif(_patch->>'equipped_nametag', '') ELSE p.equipped_nametag END,
    equipped_badge    = CASE WHEN _patch ? 'equipped_badge' THEN nullif(_patch->>'equipped_badge', '') ELSE p.equipped_badge END,
    equipped_frame    = CASE WHEN _patch ? 'equipped_frame' THEN nullif(_patch->>'equipped_frame', '') ELSE p.equipped_frame END,
    equipped_banner   = CASE WHEN _patch ? 'equipped_banner' THEN nullif(_patch->>'equipped_banner', '') ELSE p.equipped_banner END,
    equipped_effect   = CASE WHEN _patch ? 'equipped_effect' THEN nullif(_patch->>'equipped_effect', '') ELSE p.equipped_effect END
  WHERE p.id = _user_id
  RETURNING * INTO prof;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'edit_profile', _patch);

  RETURN jsonb_build_object('status', 'ok', 'username', prof.username, 'display_name', prof.display_name);
END;
$$;

-- ============ Bans actually bite ============
CREATE OR REPLACE FUNCTION public.block_banned_xp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.source <> 'staff' AND public.is_banned(NEW.user_id) THEN
    RAISE EXCEPTION 'account is banned';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS xp_events_block_banned ON public.xp_events;
CREATE TRIGGER xp_events_block_banned
BEFORE INSERT ON public.xp_events
FOR EACH ROW EXECUTE FUNCTION public.block_banned_xp();

DROP POLICY IF EXISTS community_messages_insert_members ON public.community_messages;
CREATE POLICY community_messages_insert_members ON public.community_messages
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_community_member(community_id, auth.uid())
  AND NOT public.is_banned(auth.uid())
  AND NOT public.is_muted(auth.uid())
);

DROP POLICY IF EXISTS messages_insert_members ON public.messages;
CREATE POLICY messages_insert_members ON public.messages
FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND is_friendship_member(friendship_id, auth.uid())
  AND NOT public.is_banned(auth.uid())
  AND NOT public.is_muted(auth.uid())
);

-- Staff can remove arcade scores of banned/lower-ranked players (already exists), and
-- moderators+ can read the audit log.
DROP POLICY IF EXISTS staff_actions_select_staff ON public.staff_actions;
CREATE POLICY staff_actions_select_staff ON public.staff_actions
FOR SELECT TO authenticated
USING (public.my_rank() >= 20);
