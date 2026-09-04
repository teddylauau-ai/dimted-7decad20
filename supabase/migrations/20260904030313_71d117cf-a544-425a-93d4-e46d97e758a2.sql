create table if not exists public.typing_signals (
  user_id uuid not null references auth.users on delete cascade,
  scope_type text not null check (scope_type in ('dm','channel')),
  scope_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, scope_type, scope_id)
);

grant select, insert, update, delete on public.typing_signals to authenticated;
grant all on public.typing_signals to service_role;

alter table public.typing_signals enable row level security;

create policy "typing readable by authenticated"
on public.typing_signals for select to authenticated using (true);

create policy "typing own insert"
on public.typing_signals for insert to authenticated with check (user_id = auth.uid());

create policy "typing own update"
on public.typing_signals for update to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "typing own delete"
on public.typing_signals for delete to authenticated using (user_id = auth.uid());

create index if not exists typing_signals_scope_idx on public.typing_signals (scope_type, scope_id, updated_at desc);

create or replace function public.touch_typing(_scope_type text, _scope_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  insert into public.typing_signals (user_id, scope_type, scope_id, updated_at)
  values (auth.uid(), _scope_type, _scope_id, now())
  on conflict (user_id, scope_type, scope_id)
  do update set updated_at = now();
end;
$$;

create or replace function public.clear_typing(_scope_type text, _scope_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.typing_signals
  where user_id = auth.uid() and scope_type = _scope_type and scope_id = _scope_id;
end;
$$;

grant execute on function public.touch_typing(text, uuid) to authenticated;
grant execute on function public.clear_typing(text, uuid) to authenticated;