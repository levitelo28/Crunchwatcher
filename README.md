# Crunch Watcher

A mobile-first Next.js health accountability and workout tracking app with Supabase email/password accounts.

## Run Locally

```bash
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. In Supabase, go to **SQL Editor -> New Query**.
3. Open `supabase/schema.sql`, paste the full file into the SQL Editor, and click **Run**.
4. In **Authentication -> Providers -> Email**, keep email/password enabled. If email confirmations are enabled, new users must confirm their email before logging in.
5. Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is also supported for older Supabase projects. Do not expose service role keys in the browser.

For Vercel, add the same environment variables in **Project Settings -> Environment Variables**, then redeploy.

## Reset Supabase Tables

If the deployed app is failing with missing tables or missing columns, reset only the Crunch Watcher public tables and rerun `supabase/schema.sql`.

Paste this into the Supabase SQL Editor first:

```sql
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();

drop table if exists public.workout_exercises cascade;
drop table if exists public.workout_templates cascade;
drop table if exists public.weekly_reports cascade;
drop table if exists public.rewards cascade;
drop table if exists public.workouts cascade;
drop table if exists public.daily_checkins cascade;
drop table if exists public.carb_items cascade;
drop table if exists public.goals cascade;
drop table if exists public.profiles cascade;
```

Then run the full schema file again. This does not delete users from `auth.users`, but it does delete Crunch Watcher app data in the public tables.

## Test Account Creation

1. Restart the Next.js app after adding `.env.local`.
2. Open `http://localhost:3000`.
3. Create an account with an email and a password of at least 8 characters.
4. If Supabase email confirmation is enabled, confirm the email, then log in.
5. Save Settings, complete Today, add a Workout Assistant entry, and refresh the browser.
6. Confirm the data still appears after refresh and that a second test account cannot see the first account's data.

## Structure

- `app/page.jsx` contains the client app shell and screen components.
- `app/globals.css` contains Tailwind setup and shared component classes.
- `lib/defaults.js` defines seed goals, empty check-ins, and legacy local import keys.
- `lib/scoring.js` handles daily scores, weekly stats, streaks, and badges.
- `lib/report.js` builds the shareable weekly text report.
- `lib/supabaseClient.js` creates the browser Supabase client from environment variables.
- `lib/auth.js` provides Supabase email/password auth session state and sign out.
- `lib/supabaseData.js` loads and saves app state to Supabase tables.
- `supabase/schema.sql` creates all tables, columns, profile triggers, RLS, grants, and per-user policies.

Supabase is the source of truth for goals, check-ins, workouts, rewards, and reports. Legacy `localStorage` data under `crunch-watcher-state-v1` is only detected after login so the user can import it into their account.

## PWA Setup

Crunch Watcher is configured as an installable Progressive Web App using `next-pwa`.

- `public/manifest.json` defines the app name, standalone display mode, theme colors, and icons.
- `public/icons/` contains the 192x192 icon, 512x512 icon, Apple touch icon, and logo SVG.
- `public/offline.html` is the fallback page when a document request cannot be served online.
- `next.config.mjs` configures service worker generation, static asset caching, and offline fallbacks.
- The in-app **Install** tab explains iPhone and Android installation and notification behavior.

Install testing:

1. Build and start the production app:

```bash
npm.cmd run build
npm.cmd run start
```

2. Open `http://localhost:3000` in Chrome or Safari.
3. Confirm the browser offers install or open the **Install** tab.
4. Install the app, launch it from the home screen, and confirm it opens without browser chrome.
5. Turn off the network after loading the app once and confirm cached pages still open.

Notifications:

- The app requests browser notification permission from the reminder banner or **Install** tab.
- Daily check-in reminders use the Settings check-in time.
- Workout reminders use the Settings workout reminder time.
- Browser support varies. iPhone notifications generally require the app to be installed to the home screen first.
