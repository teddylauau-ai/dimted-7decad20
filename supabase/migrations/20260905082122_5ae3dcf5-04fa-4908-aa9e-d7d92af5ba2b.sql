CREATE OR REPLACE FUNCTION public.crew_rank_level(_role public.crew_role)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE _role
    WHEN 'owner' THEN 5
    WHEN 'captain' THEN 4
    WHEN 'lieutenant' THEN 3
    WHEN 'member' THEN 2
    WHEN 'recruit' THEN 1
    ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.set_crew_rank(_crew_id uuid, _user_id uuid, _role text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _my public.crew_role;
  _their public.crew_role;
  _new public.crew_role;
  _staff boolean;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  _staff := public.is_staff(_uid);
  _new := _role::public.crew_role;

  IF _new = 'owner' THEN RAISE EXCEPTION 'Use crew transfer to change the Captain'; END IF;

  SELECT role INTO _their FROM public.crew_members WHERE crew_id = _crew_id AND user_id = _user_id;
  IF _their IS NULL THEN RAISE EXCEPTION 'Not a crew member'; END IF;
  IF _their = 'owner' THEN RAISE EXCEPTION 'The Captain cannot be demoted'; END IF;

  SELECT role INTO _my FROM public.crew_members WHERE crew_id = _crew_id AND user_id = _uid;

  IF NOT _staff THEN
    IF _my IS NULL OR public.crew_rank_level(_my) < 4 THEN
      RAISE EXCEPTION 'Only the Captain or a First Mate can change ranks';
    END IF;
    IF _user_id = _uid THEN RAISE EXCEPTION 'You cannot change your own rank'; END IF;
    IF public.crew_rank_level(_new) >= public.crew_rank_level(_my)
       OR public.crew_rank_level(_their) >= public.crew_rank_level(_my) THEN
      RAISE EXCEPTION 'You can only manage ranks below your own';
    END IF;
  END IF;

  UPDATE public.crew_members SET role = _new WHERE crew_id = _crew_id AND user_id = _user_id;
  RETURN jsonb_build_object('ok', true, 'role', _new);
END;
$$;

REVOKE ALL ON FUNCTION public.set_crew_rank(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_crew_rank(uuid, uuid, text) TO authenticated;