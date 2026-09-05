revoke execute on function public.can_use_call(uuid, uuid) from anon, public;
revoke execute on function public.can_use_call_scope(text, uuid, uuid) from anon, public;
revoke execute on function public.trim_call_signals() from anon, authenticated, public;
revoke execute on function public.on_profile_founder_grant() from anon, authenticated, public;
revoke execute on function public.on_role_admin_grant() from anon, authenticated, public;
revoke execute on function public.grant_admin_cosmetics(uuid) from anon, authenticated, public;
revoke execute on function public.staff_grant_pulse(uuid, text, integer) from anon, public;
revoke execute on function public.staff_complete_pulse(uuid, integer) from anon, public;
revoke execute on function public.pulse_finish(integer, integer, integer, integer, boolean, boolean) from anon, public;
revoke execute on function public.claim_armory_milestone(text) from anon, public;

grant execute on function public.can_use_call(uuid, uuid) to authenticated;
grant execute on function public.can_use_call_scope(text, uuid, uuid) to authenticated;
grant execute on function public.staff_grant_pulse(uuid, text, integer) to authenticated;
grant execute on function public.staff_complete_pulse(uuid, integer) to authenticated;
grant execute on function public.pulse_finish(integer, integer, integer, integer, boolean, boolean) to authenticated;
grant execute on function public.claim_armory_milestone(text) to authenticated;