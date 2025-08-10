-- Tables
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  total_bytes bigint not null default 0
);

-- Update timestamp trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists chat_sessions_set_updated_at on public.chat_sessions;
create trigger chat_sessions_set_updated_at
before update on public.chat_sessions
for each row execute procedure public.set_updated_at();

-- RLS
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.user_usage enable row level security;

-- Policies
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_sessions' and policyname='chat_sessions_select') then
    create policy chat_sessions_select on public.chat_sessions for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_sessions' and policyname='chat_sessions_modify') then
    create policy chat_sessions_modify on public.chat_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='chat_messages_select') then
    create policy chat_messages_select on public.chat_messages for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='chat_messages' and policyname='chat_messages_modify') then
    create policy chat_messages_modify on public.chat_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_usage' and policyname='user_usage_select') then
    create policy user_usage_select on public.user_usage for select using (auth.uid() = user_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='user_usage' and policyname='user_usage_modify') then
    create policy user_usage_modify on public.user_usage for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
