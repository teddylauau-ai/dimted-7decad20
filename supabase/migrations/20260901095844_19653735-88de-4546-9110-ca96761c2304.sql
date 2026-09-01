CREATE OR REPLACE FUNCTION public.staff_grant_currency(_user_id uuid, _xp integer DEFAULT 0, _sparks integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rank integer := public.my_rank();
  v_cap integer;
  v_xp integer;
  v_sparks integer;
  prof public.profiles;
BEGIN
  IF v_rank < 30 THEN RETURN jsonb_build_object('status', 'forbidden'); END IF;
  v_cap := CASE WHEN v_rank >= 40 THEN 10000000 ELSE 25000 END;

  v_xp := greatest(-v_cap, least(coalesce(_xp, 0), v_cap));
  v_sparks := greatest(-v_cap, least(coalesce(_sparks, 0), v_cap));

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id) THEN
    RETURN jsonb_build_object('status', 'no_target');
  END IF;

  UPDATE public.profiles p
  SET total_xp = greatest(0, p.total_xp + v_xp),
      sparks = greatest(0, p.sparks + v_sparks)
  WHERE p.id = _user_id
  RETURNING p.* INTO prof;

  IF v_xp <> 0 THEN
    INSERT INTO public.xp_events (user_id, source, amount, label)
    VALUES (_user_id, 'staff', v_xp, 'staff grant');
  END IF;

  INSERT INTO public.staff_actions (actor_id, target_id, action, detail)
  VALUES (auth.uid(), _user_id, 'grant_currency', jsonb_build_object('xp', v_xp, 'sparks', v_sparks));

  RETURN jsonb_build_object('status', 'granted', 'total_xp', prof.total_xp, 'sparks', prof.sparks);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_grant_currency(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_grant_currency(uuid, integer, integer) TO authenticated;
