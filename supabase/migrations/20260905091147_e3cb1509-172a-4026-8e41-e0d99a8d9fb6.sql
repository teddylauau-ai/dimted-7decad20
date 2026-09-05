CREATE OR REPLACE FUNCTION public.set_crew_rank(_crew_id uuid, _user_id uuid, _role text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _my public.crew_role;
  _their public.crew_role;
  _new public.crew_role;
  _staff boolean;
  _joint int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _staff := public.is_staff(_uid);
  _new := _role::public.crew_role;

  IF _new = 'owner' THEN RAISE EXCEPTION 'Use crew transfer to change the Captain'; END IF;

  SELECT role INTO _their FROM public.crew_members WHERE crew_id = _crew_id AND user_id = _user_id;
  IF _their IS NULL THEN RAISE EXCEPTION 'Not a crew member'; END IF;
  IF _their = 'owner' THEN RAISE EXCEPTION 'The Captain cannot be demoted'; END IF;

  SELECT role INTO _my FROM public.crew_members WHERE crew_id = _crew_id AND user_id = _uid;

  -- Only one Joint Captain per crew (so a crew has at most two captains).
  IF _new = 'captain' AND _their <> 'captain' THEN
    SELECT count(*) INTO _joint
      FROM public.crew_members
     WHERE crew_id = _crew_id AND role = 'captain';
    IF _joint >= 1 THEN
      RAISE EXCEPTION 'This crew already has a Joint Captain — demote them first';
    END IF;
    IF NOT _staff AND (_my IS NULL OR _my <> 'owner') THEN
      RAISE EXCEPTION 'Only the Captain can appoint a Joint Captain';
    END IF;
  END IF;

  IF NOT _staff THEN
    IF _my IS NULL OR public.crew_rank_level(_my) < 4 THEN
      RAISE EXCEPTION 'Only the Captain or a Joint Captain can change ranks';
    END IF;
    IF _user_id = _uid THEN RAISE EXCEPTION 'You cannot change your own rank'; END IF;
    IF public.crew_rank_level(_their) >= public.crew_rank_level(_my) THEN
      RAISE EXCEPTION 'You can only manage ranks below your own';
    END IF;
    IF _new <> 'captain' AND public.crew_rank_level(_new) >= public.crew_rank_level(_my) THEN
      RAISE EXCEPTION 'You can only manage ranks below your own';
    END IF;
  END IF;

  UPDATE public.crew_members SET role = _new WHERE crew_id = _crew_id AND user_id = _user_id;
  RETURN jsonb_build_object('ok', true, 'role', _new);
END;
$function$;