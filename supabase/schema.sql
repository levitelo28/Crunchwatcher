-- Crunch Watcher Supabase schema
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> New Query.
-- It is safe to re-run: it creates missing tables/columns, refreshes RLS policies,
-- and installs a profile creation trigger for new Supabase Auth users.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles are keyed by auth.users(id). The app also writes/filters user_id, so
-- both id and user_id are present and kept equal for schema-cache compatibility.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid unique references auth.users(id) on delete cascade,
  email text,
  phone text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists full_name text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists created_at timestamptz not null default now();
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles set user_id = id where user_id is null;
alter table public.profiles alter column user_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_user_id_key' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles add constraint profiles_user_id_key unique (user_id);
  end if;
end $$;

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

alter table public.goals add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.goals add column if not exists program_length integer not null default 30;
alter table public.goals add column if not exists track_alcohol boolean not null default true;
alter table public.goals add column if not exists track_sweets boolean not null default true;
alter table public.goals add column if not exists water jsonb not null default '{}'::jsonb;
alter table public.goals add column if not exists exercise jsonb not null default '{}'::jsonb;
alter table public.goals add column if not exists custom_habits jsonb not null default '[]'::jsonb;
alter table public.goals add column if not exists custom_trackers jsonb not null default '[]'::jsonb;
alter table public.goals add column if not exists reminder_time text default '20:30';
alter table public.goals add column if not exists workout_goals jsonb not null default '{}'::jsonb;
alter table public.goals add column if not exists created_at timestamptz not null default now();
alter table public.goals add column if not exists updated_at timestamptz not null default now();

create table if not exists public.carb_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text,
  name text not null,
  daily_max numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.carb_items add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.carb_items add column if not exists local_id text;
alter table public.carb_items add column if not exists name text;
alter table public.carb_items add column if not exists daily_max numeric not null default 0;
alter table public.carb_items add column if not exists created_at timestamptz not null default now();
alter table public.carb_items add column if not exists updated_at timestamptz not null default now();

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

alter table public.daily_checkins add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.daily_checkins add column if not exists day integer;
alter table public.daily_checkins add column if not exists checkin_date timestamptz;
alter table public.daily_checkins add column if not exists completed boolean not null default false;
alter table public.daily_checkins add column if not exists score integer not null default 0;
alter table public.daily_checkins add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.daily_checkins add column if not exists created_at timestamptz not null default now();
alter table public.daily_checkins add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'daily_checkins_user_id_day_key' and conrelid = 'public.daily_checkins'::regclass
  ) then
    alter table public.daily_checkins add constraint daily_checkins_user_id_day_key unique (user_id, day);
  end if;
end $$;

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

alter table public.workouts add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.workouts add column if not exists date timestamptz not null default now();
alter table public.workouts add column if not exists name text;
alter table public.workouts add column if not exists type text;
alter table public.workouts add column if not exists duration numeric;
alter table public.workouts add column if not exists intensity text;
alter table public.workouts add column if not exists energy integer;
alter table public.workouts add column if not exists notes text;
alter table public.workouts add column if not exists performance_note text;
alter table public.workouts add column if not exists created_at timestamptz not null default now();
alter table public.workouts add column if not exists updated_at timestamptz not null default now();

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
  heart_rate numeric,
  rpe numeric,
  notes text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.workout_exercises add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.workout_exercises add column if not exists workout_id uuid references public.workouts(id) on delete cascade;
alter table public.workout_exercises add column if not exists local_id text;
alter table public.workout_exercises add column if not exists name text;
alter table public.workout_exercises add column if not exists sets numeric;
alter table public.workout_exercises add column if not exists reps numeric;
alter table public.workout_exercises add column if not exists weight numeric;
alter table public.workout_exercises add column if not exists distance numeric;
alter table public.workout_exercises add column if not exists pace text;
alter table public.workout_exercises add column if not exists time text;
alter table public.workout_exercises add column if not exists heart_rate numeric;
alter table public.workout_exercises add column if not exists rpe numeric;
alter table public.workout_exercises add column if not exists notes text;
alter table public.workout_exercises add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.workout_exercises add column if not exists created_at timestamptz not null default now();
alter table public.workout_exercises add column if not exists updated_at timestamptz not null default now();

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

alter table public.rewards add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.rewards add column if not exists badge_key text;
alter table public.rewards add column if not exists earned boolean not null default false;
alter table public.rewards add column if not exists earned_at timestamptz;
alter table public.rewards add column if not exists created_at timestamptz not null default now();
alter table public.rewards add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'rewards_user_id_badge_key_key' and conrelid = 'public.rewards'::regclass
  ) then
    alter table public.rewards add constraint rewards_user_id_badge_key_key unique (user_id, badge_key);
  end if;
end $$;

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

alter table public.weekly_reports add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.weekly_reports add column if not exists week_number integer;
alter table public.weekly_reports add column if not exists average_score integer not null default 0;
alter table public.weekly_reports add column if not exists report_text text;
alter table public.weekly_reports add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.weekly_reports add column if not exists created_at timestamptz not null default now();
alter table public.weekly_reports add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'weekly_reports_user_id_week_number_key' and conrelid = 'public.weekly_reports'::regclass
  ) then
    alter table public.weekly_reports add constraint weekly_reports_user_id_week_number_key unique (user_id, week_number);
  end if;
end $$;

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

alter table public.workout_templates add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.workout_templates add column if not exists name text;
alter table public.workout_templates add column if not exists type text;
alter table public.workout_templates add column if not exists duration numeric;
alter table public.workout_templates add column if not exists intensity text;
alter table public.workout_templates add column if not exists exercises jsonb not null default '[]'::jsonb;
alter table public.workout_templates add column if not exists created_at timestamptz not null default now();
alter table public.workout_templates add column if not exists updated_at timestamptz not null default now();

create index if not exists goals_user_id_idx on public.goals(user_id);
create index if not exists carb_items_user_id_idx on public.carb_items(user_id);
create index if not exists daily_checkins_user_id_day_idx on public.daily_checkins(user_id, day);
create index if not exists workouts_user_id_date_idx on public.workouts(user_id, date desc);
create index if not exists workout_exercises_user_id_workout_id_idx on public.workout_exercises(user_id, workout_id);
create index if not exists rewards_user_id_idx on public.rewards(user_id);
create index if not exists weekly_reports_user_id_week_idx on public.weekly_reports(user_id, week_number);
create index if not exists workout_templates_user_id_idx on public.workout_templates(user_id);

-- New profile rows are created automatically when email/password signup creates
-- an auth.users row. The frontend also calls ensureProfile(), so this is a
-- belt-and-suspenders guard against missing profile rows.
create or replace function public.handle_new_user()
returns trigger
security definer
set search_path = public
language plpgsql
as $$
begin
  insert into public.profiles (id, user_id, email, phone, full_name, avatar_url)
  values (
    new.id,
    new.id,
    new.email,
    new.phone,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update
  set
    user_id = excluded.user_id,
    email = excluded.email,
    phone = excluded.phone,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;

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
    execute format('drop policy if exists %I on public.%I', table_name || '_select_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update_own', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete_own', table_name);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_select_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      table_name || '_insert_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      table_name || '_update_own',
      table_name
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      table_name || '_delete_own',
      table_name
    );
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
    execute format('drop trigger if exists %I on public.%I', 'set_' || table_name || '_updated_at', table_name);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.set_updated_at()',
      'set_' || table_name || '_updated_at',
      table_name
    );
  end loop;
end $$;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles,
  public.goals,
  public.carb_items,
  public.daily_checkins,
  public.workouts,
  public.workout_exercises,
  public.rewards,
  public.weekly_reports,
  public.workout_templates
to authenticated;

notify pgrst, 'reload schema';
