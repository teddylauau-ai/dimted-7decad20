create table public.calls (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('dm','channel')),
  scope_id uuid not null,
  started_by uuid not null references public.profiles(id) on delete cascade,
  video boolean not null default false,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);
create index calls_scope_idx on public.calls (scope_type, scope_id, created_at desc);

create table public.call_participants (
  id uuid primary key default gen_random_uuid(),
  call_id uuid not null references public.calls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  video boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (call_id, user_id)
);
create index call_participants_call_idx on public.call_participants (call_id);

create table public.call_signals (
  id bigserial primary key,
  call_id uuid not null references public.calls(id) on delete cascade,
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('offer','answer','ice','leave')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index call_signals_call_idx on public.call_signals (call_id, id);

grant select, insert, update, delete on public.calls to authenticated;
grant select, insert, update, delete on public.call_participants to authenticated;
grant select, insert, update, delete on public.call_signals to authenticated;
grant usage, select on sequence public.call_signals_id_seq to authenticated;
grant all on public.calls to service_role;
grant all on public.call_participants to service_role;
grant all on public.call_signals to service_role;
grant all on sequence public.call_signals_id_seq to service_role;

create or replace function public.can_use_call_scope(_scope_type text, _scope_id uuid, _user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _community uuid;
begin
  if _user_id is null then
    return false;
  end if;
  if public.is_banned(_user_id) then
    return false;
  end if;
  if _scope_type = 'dm' then
    return public.is_friendship_member(_scope_id, _user_id);
  end if;
  select community_id into _community from public.channels where id = _scope_id;
  if _community is null then
    return false;
  end if;
  return public.is_community_member(_community, _user_id);
end;
$$;

grant execute on function public.can_use_call_scope(text, uuid, uuid) to authenticated;

create or replace function public.can_use_call(_call_id uuid, _user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.calls c
    where c.id = _call_id
      and public.can_use_call_scope(c.scope_type, c.scope_id, _user_id)
  )
$$;

grant execute on function public.can_use_call(uuid, uuid) to authenticated;

alter table public.calls enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_signals enable row level security;

create policy "Members read calls in their scope"
on public.calls for select to authenticated
using (public.can_use_call_scope(scope_type, scope_id, auth.uid()));

create policy "Members start calls in their scope"
on public.calls for insert to authenticated
with check (started_by = auth.uid() and public.can_use_call_scope(scope_type, scope_id, auth.uid()));

create policy "Members end calls in their scope"
on public.calls for update to authenticated
using (public.can_use_call_scope(scope_type, scope_id, auth.uid()))
with check (public.can_use_call_scope(scope_type, scope_id, auth.uid()));

create policy "Members read call participants"
on public.call_participants for select to authenticated
using (public.can_use_call(call_id, auth.uid()));

create policy "Users join calls as themselves"
on public.call_participants for insert to authenticated
with check (user_id = auth.uid() and public.can_use_call(call_id, auth.uid()));

create policy "Users update their own participation"
on public.call_participants for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users leave calls"
on public.call_participants for delete to authenticated
using (user_id = auth.uid());

create policy "Participants read addressed signals"
on public.call_signals for select to authenticated
using (
  public.can_use_call(call_id, auth.uid())
  and (to_user is null or to_user = auth.uid() or from_user = auth.uid())
);

create policy "Participants send signals"
on public.call_signals for insert to authenticated
with check (from_user = auth.uid() and public.can_use_call(call_id, auth.uid()));

create policy "Senders clear their signals"
on public.call_signals for delete to authenticated
using (from_user = auth.uid());

create or replace function public.trim_call_signals()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.call_signals where created_at < now() - interval '5 minutes';
  delete from public.calls where ended_at is not null and ended_at < now() - interval '1 day';
  return new;
end;
$$;

create trigger trim_call_signals_after_insert
after insert on public.call_signals
for each row execute function public.trim_call_signals();