-- Roles -----------------------------------------------------------------
create type public.app_role as enum ('owner', 'admin', 'moderator', 'member');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  )
$$;

create or replace function public.is_staff(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('owner', 'admin')
  )
$$;

create policy user_roles_select_signed_in
  on public.user_roles for select to authenticated using (true);

create policy user_roles_insert_staff
  on public.user_roles for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'owner')
    or (public.has_role(auth.uid(), 'admin') and role in ('moderator', 'member'))
  );

create policy user_roles_delete_staff
  on public.user_roles for delete to authenticated
  using (
    public.has_role(auth.uid(), 'owner')
    or (public.has_role(auth.uid(), 'admin') and role in ('moderator', 'member'))
  );

-- The founding account owns Dimted.
insert into public.user_roles (user_id, role)
select id, 'owner'::public.app_role from public.profiles
order by created_at asc
limit 1
on conflict do nothing;

-- Arcade scores ---------------------------------------------------------
create table public.game_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  score integer not null default 0,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_scores_game_score_idx on public.game_scores (game, score desc);
create index game_scores_user_idx on public.game_scores (user_id);

grant select, insert on public.game_scores to authenticated;
grant delete on public.game_scores to authenticated;
grant all on public.game_scores to service_role;

alter table public.game_scores enable row level security;

create policy game_scores_select_signed_in
  on public.game_scores for select to authenticated using (true);

create policy game_scores_insert_self
  on public.game_scores for insert to authenticated
  with check (user_id = auth.uid() and score >= 0 and score <= 1000000);

create policy game_scores_delete_self_or_staff
  on public.game_scores for delete to authenticated
  using (user_id = auth.uid() or public.is_staff(auth.uid()));
