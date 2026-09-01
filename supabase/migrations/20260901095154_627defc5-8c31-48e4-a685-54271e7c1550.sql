REVOKE ALL ON FUNCTION public.award_arcade_xp(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_arcade_xp(text, integer) TO authenticated;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.is_staff(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated;