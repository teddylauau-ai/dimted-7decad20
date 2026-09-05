-- Owner deletes an entire crew
CREATE OR REPLACE FUNCTION public.owner_delete_crew(_crew_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  SELECT name INTO v_name FROM public.crews WHERE id = _crew_id;
  IF v_name IS NULL THEN RETURN jsonb_build_object('status', 'missing'); END IF;

  DELETE FROM public.crew_messages WHERE crew_id = _crew_id;
  DELETE FROM public.crew_invites WHERE crew_id = _crew_id;
  DELETE FROM public.crew_members WHERE crew_id = _crew_id;
  DELETE FROM public.crews WHERE id = _crew_id;

  INSERT INTO public.staff_actions (actor_id, action, detail)
  VALUES (auth.uid(), 'crew_delete', jsonb_build_object('crew', v_name));
  RETURN jsonb_build_object('status', 'ok', 'crew', v_name);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_delete_crew(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_delete_crew(uuid) TO authenticated;

-- Owner edits any crew field, including shared XP
CREATE OR REPLACE FUNCTION public.owner_edit_crew(_crew_id uuid, _patch jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crews WHERE id = _crew_id) THEN
    RETURN jsonb_build_object('status', 'missing');
  END IF;

  UPDATE public.crews SET
    name = COALESCE(NULLIF(_patch->>'name', ''), name),
    tagline = COALESCE(_patch->>'tagline', tagline),
    description = COALESCE(_patch->>'description', description),
    badge_emoji = COALESCE(NULLIF(_patch->>'badge_emoji', ''), badge_emoji),
    accent = COALESCE(NULLIF(_patch->>'accent', ''), accent),
    badge_style = COALESCE(NULLIF(_patch->>'badge_style', ''), badge_style),
    nametag_style = COALESCE(NULLIF(_patch->>'nametag_style', ''), nametag_style),
    text_effect = COALESCE(NULLIF(_patch->>'text_effect', ''), text_effect),
    chat_bg = COALESCE(NULLIF(_patch->>'chat_bg', ''), chat_bg),
    visibility = COALESCE(NULLIF(_patch->>'visibility', ''), visibility),
    join_policy = COALESCE(NULLIF(_patch->>'join_policy', ''), join_policy),
    banner_url = COALESCE(_patch->>'banner_url', banner_url),
    avatar_url = COALESCE(_patch->>'avatar_url', avatar_url),
    member_limit = COALESCE((_patch->>'member_limit')::int, member_limit),
    total_xp = GREATEST(0, COALESCE((_patch->>'total_xp')::int, total_xp)),
    updated_at = now()
  WHERE id = _crew_id;

  INSERT INTO public.staff_actions (actor_id, action, detail)
  VALUES (auth.uid(), 'crew_edit', jsonb_build_object('crew_id', _crew_id, 'patch', _patch));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_edit_crew(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_edit_crew(uuid, jsonb) TO authenticated;

-- Owner removes a crew member
CREATE OR REPLACE FUNCTION public.owner_remove_crew_member(_crew_id uuid, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  DELETE FROM public.crew_members WHERE crew_id = _crew_id AND user_id = _user_id;
  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'crew_member_remove', jsonb_build_object('crew_id', _crew_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_remove_crew_member(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_remove_crew_member(uuid, uuid) TO authenticated;

-- Owner hands a crew to a new leader
CREATE OR REPLACE FUNCTION public.owner_transfer_crew(_crew_id uuid, _user_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'missing');
  END IF;

  INSERT INTO public.crew_members (crew_id, user_id, role)
  VALUES (_crew_id, _user_id, 'owner')
  ON CONFLICT (crew_id, user_id) DO UPDATE SET role = 'owner';

  UPDATE public.crew_members SET role = 'captain'
  WHERE crew_id = _crew_id AND user_id <> _user_id AND role = 'owner';

  UPDATE public.crews SET owner_id = _user_id, updated_at = now() WHERE id = _crew_id;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'crew_transfer', jsonb_build_object('crew_id', _crew_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_transfer_crew(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_transfer_crew(uuid, uuid) TO authenticated;

-- Staff clean-up for crew and general chat
CREATE OR REPLACE FUNCTION public.mod_delete_crew_message(_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  SELECT user_id INTO v_user FROM public.crew_messages WHERE id = _message_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('status', 'missing'); END IF;
  DELETE FROM public.crew_messages WHERE id = _message_id;
  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), v_user, 'crew_message_delete', jsonb_build_object('message_id', _message_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mod_delete_crew_message(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mod_delete_crew_message(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mod_delete_general_message(_message_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  SELECT user_id INTO v_user FROM public.general_messages WHERE id = _message_id;
  IF v_user IS NULL THEN RETURN jsonb_build_object('status', 'missing'); END IF;
  DELETE FROM public.general_messages WHERE id = _message_id;
  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), v_user, 'general_message_delete', jsonb_build_object('message_id', _message_id));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mod_delete_general_message(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.mod_delete_general_message(uuid) TO authenticated;

-- Owner sets a player's season progress
CREATE OR REPLACE FUNCTION public.owner_set_season_xp(_user_id uuid, _xp integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_season uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'owner') THEN
    RETURN jsonb_build_object('status', 'forbidden');
  END IF;
  SELECT id INTO v_season FROM public.seasons WHERE active ORDER BY starts_at DESC LIMIT 1;
  IF v_season IS NULL THEN RETURN jsonb_build_object('status', 'no_season'); END IF;

  INSERT INTO public.season_progress (user_id, season_id, xp)
  VALUES (_user_id, v_season, GREATEST(0, _xp))
  ON CONFLICT (user_id, season_id) DO UPDATE SET xp = GREATEST(0, _xp), updated_at = now();

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'season_xp_set', jsonb_build_object('xp', _xp));
  RETURN jsonb_build_object('status', 'ok');
END;
$$;
REVOKE EXECUTE ON FUNCTION public.owner_set_season_xp(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_set_season_xp(uuid, integer) TO authenticated;

-- Owner can always reach every crew row directly too
DROP POLICY IF EXISTS "Owner manages every crew" ON public.crews;
CREATE POLICY "Owner manages every crew" ON public.crews
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

DROP POLICY IF EXISTS "Owner sees every crew member" ON public.crew_members;
CREATE POLICY "Owner sees every crew member" ON public.crew_members
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'owner'));