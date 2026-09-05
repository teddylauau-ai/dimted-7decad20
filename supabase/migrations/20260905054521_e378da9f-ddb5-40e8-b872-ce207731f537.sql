ALTER TABLE public.crews ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.update_crew(_crew_id uuid, _patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not signed in'); END IF;
  IF NOT (public.is_crew_manager(_crew_id, _uid) OR public.is_staff(_uid)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not allowed');
  END IF;

  UPDATE public.crews SET
    name = coalesce(nullif(left(trim(_patch->>'name'), 40), ''), name),
    tagline = CASE WHEN _patch ? 'tagline' THEN nullif(left(coalesce(trim(_patch->>'tagline'), ''), 90), '') ELSE tagline END,
    description = CASE WHEN _patch ? 'description' THEN nullif(left(coalesce(trim(_patch->>'description'), ''), 400), '') ELSE description END,
    badge_emoji = coalesce(nullif(trim(_patch->>'badge_emoji'), ''), badge_emoji),
    banner_url = CASE WHEN _patch ? 'banner_url' THEN nullif(_patch->>'banner_url', '') ELSE banner_url END,
    avatar_url = CASE WHEN _patch ? 'avatar_url' THEN nullif(_patch->>'avatar_url', '') ELSE avatar_url END,
    accent = CASE WHEN _patch->>'accent' IN ('teal','violet','amber','rose','emerald','sky','slate') THEN _patch->>'accent' ELSE accent END,
    visibility = CASE WHEN _patch->>'visibility' IN ('public','private') THEN _patch->>'visibility' ELSE visibility END,
    join_policy = CASE WHEN _patch->>'join_policy' IN ('open','invite') THEN _patch->>'join_policy' ELSE join_policy END
  WHERE id = _crew_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_use_call_scope(_scope_type text, _scope_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  _community uuid;
begin
  if _user_id is null then
    return false;
  end if;
  if public.is_banned(_user_id) then
    return false;
  end if;
  if _scope_type = 'dm' then
    return public.is_friendship_member(_scope_id, _user_id);
  end if;
  if _scope_type = 'crew' then
    return public.is_crew_member(_scope_id, _user_id);
  end if;
  select community_id into _community from public.channels where id = _scope_id;
  if _community is null then
    return false;
  end if;
  return public.is_community_member(_community, _user_id);
end;
$function$;