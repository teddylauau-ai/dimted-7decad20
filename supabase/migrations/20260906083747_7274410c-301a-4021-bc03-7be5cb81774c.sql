REVOKE ALL ON FUNCTION public.rift_state_for_me() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rift_buy(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rift_equip(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rift_stars_earned(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rift_state_for_me() TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_buy(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_equip(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rift_stars_earned(uuid) TO authenticated;