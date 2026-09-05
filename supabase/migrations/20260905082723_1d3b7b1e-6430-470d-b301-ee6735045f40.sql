ALTER TABLE public.crew_members ADD COLUMN IF NOT EXISTS contributed_xp integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.crew_contribute_xp(_crew_id uuid, _amount integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'auth');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.crew_members WHERE crew_id = _crew_id AND user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_member');
  END IF;
  UPDATE public.crews SET total_xp = total_xp + _amount WHERE id = _crew_id;
  UPDATE public.crew_members SET contributed_xp = contributed_xp + _amount WHERE crew_id = _crew_id AND user_id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;