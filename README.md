# Crunch Watcher

A simple mobile-first Next.js health accountability tracker for a 30-day program.

## Run

```bash
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:3000`.

## Supabase Setup

1. Create a Supabase project.
2. Run [supabase/schema.sql](C:\Users\Levi\Documents\Codex\2026-05-19\build-a-very-simple-mobile-first\supabase\schema.sql) in the Supabase SQL editor.
3. Enable Google Auth in Supabase Auth providers and add your Vercel/local redirect URL.
4. Enable Phone Auth in Supabase if you want SMS OTP login.
5. Create `.env.local` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Only use the anon key in the browser. Never expose a service role key.

For Vercel, add the same two variables in Project Settings -> Environment Variables.

## Structure

- `app/page.jsx` contains the client app shell and screen components.
- `app/globals.css` contains Tailwind setup and shared component classes.
- `lib/defaults.js` defines seed goals, empty check-ins, and localStorage keys.
- `lib/scoring.js` handles daily scores, weekly stats, streaks, and badges.
- `lib/report.js` builds the shareable weekly text report.
- `lib/supabaseClient.js` creates the browser Supabase client from environment variables.
- `lib/auth.js` provides Supabase Auth session state, Google login, phone OTP, and sign out.
- `lib/supabaseData.js` loads/saves the app state to Supabase tables and imports old local data.
- `supabase/schema.sql` creates tables, timestamps, RLS, and per-user policies.

When Supabase is configured, app data is saved to Supabase per authenticated user. Old `localStorage` data under `crunch-watcher-state-v1` is detected after login and can be imported into the user account.
