-- Crunch Watcher Supabase schema
-- Run this in the Supabase SQL editor. It creates per-user tables and RLS policies.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  program_length integer not null default 30,
  track_alcohol boolean not null default true,
  track_sweets boolean not null default true,
  water jsonb not null default '{}'::jsonb,
  exercise jsonb not null default '{}'::jsonb,
  custom_habits jsonb not null default '[]'::jsonb,
  custom_trackers jsonb not null default '[]'::jsonb,
  reminder_time text default '20:30',
  workout_goals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.carb_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text,
  name text not null,
  daily_max numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day integer not null,
  checkin_date timestamptz,
  completed boolean not null default false,
  score integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, day)
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date timestamptz not null default now(),
  name text,
  type text,
  duration numeric,
  intensity text,
  energy integer,
  notes text,
  performance_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_id uuid not null references public.workouts(id) on delete cascade,
  local_id text,
  name text,
  sets numeric,
  reps numeric,
  weight numeric,
  distance numeric,
  pace text,
  time text,
  rpe numeric,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_key text not null,
  earned boolean not null default false,
  earned_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, badge_key)
);

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_number integer not null,
  average_score integer not null default 0,
  report_text text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, week_number)
);

create table if not exists public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text,
  duration numeric,
  intensity text,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'goals',
    'carb_items',
    'daily_checkins',
    'workouts',
    'workout_exercises',
    'rewards',
    'weekly_reports',
    'workout_templates'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%I_select_own" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%I_insert_own" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%I_update_own" on public.%I', table_name, table_name);
    execute format('drop policy if exists "%I_delete_own" on public.%I', table_name, table_name);

    execute format('create policy "%I_select_own" on public.%I for select using (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy "%I_insert_own" on public.%I for insert with check (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy "%I_update_own" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', table_name, table_name);
    execute format('create policy "%I_delete_own" on public.%I for delete using (auth.uid() = user_id)', table_name, table_name);
  end loop;
end $$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'goals',
    'carb_items',
    'daily_checkins',
    'workouts',
    'workout_exercises',
    'rewards',
    'weekly_reports',
    'workout_templates'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;
