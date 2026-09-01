REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bump_friendship_on_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_friendship_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_community_member(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.award_xp(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ignite_surge() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.award_xp(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ignite_surge() TO authenticated;