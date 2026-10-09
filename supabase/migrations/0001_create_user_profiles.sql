-- =============================================================================
-- หนี้น้อย (Nee Noi) — demographic profile table for Supabase
-- -----------------------------------------------------------------------------
-- Run this once in the Supabase dashboard:
--   SQL Editor -> New query -> paste this file -> Run
--
-- Why this migration exists (verified against project fmclnzknczkahlmcazfw):
--   * table `public.user_profiles` did NOT exist -> every profile insert failed
--   * table `public.User` exists (password, gender, age, occupation) but is
--     blocked by RLS for the anon key and stores passwords in plain text while
--     allowing anon SELECT — it is not used by the app.
--
-- Column names match exactly what src/services/supabaseService.js writes:
--   user_id, username, name, email, gender, age, occupation, role, updated_at
-- `password` is intentionally NOT stored here: Supabase Auth owns the password
-- (auth.users.encrypted_password). Never write passwords to a Postgres table.
-- =============================================================================

create table if not exists public.user_profiles (
  user_id     uuid        primary key references auth.users (id) on delete cascade,
  username    text        unique,
  name        text,
  email       text,
  gender      text,
  age         integer,
  occupation  text,
  role        text        not null default 'user',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists user_profiles_username_idx on public.user_profiles (username);

-- ---------------------------------------------------------------------------
-- Row Level Security: only the signed-in owner may read/write their row.
-- (The anon key can never write profiles — which is why the app reports a
--  readable Thai warning until this migration has been run.)
-- ---------------------------------------------------------------------------
alter table public.user_profiles enable row level security;

drop policy if exists "profiles_select_own" on public.user_profiles;
create policy "profiles_select_own"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "profiles_insert_own" on public.user_profiles;
create policy "profiles_insert_own"
  on public.user_profiles for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profiles_update_own" on public.user_profiles;
create policy "profiles_update_own"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Keep updated_at fresh on every update.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists user_profiles_touch on public.user_profiles;
create trigger user_profiles_touch
  before update on public.user_profiles
  for each row execute function public.touch_updated_at();
