delete from public.typing_signals ts
where not exists (select 1 from public.profiles p where p.id = ts.user_id);

alter table public.typing_signals drop constraint typing_signals_user_id_fkey;

alter table public.typing_signals
  add constraint typing_signals_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;