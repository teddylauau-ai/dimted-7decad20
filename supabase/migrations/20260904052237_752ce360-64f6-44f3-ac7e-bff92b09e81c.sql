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

ALTER TABLE public.profiles DROP COLUMN IF EXISTS realm_name;