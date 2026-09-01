REVOKE EXECUTE ON FUNCTION public.mod_set_mute(uuid, integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.admin_set_ban(uuid, integer, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mod_delete_message(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.owner_edit_profile(uuid, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_banned(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_muted(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.block_banned_xp() FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.mod_set_mute(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_ban(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mod_delete_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_edit_profile(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_banned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_muted(uuid) TO authenticated;