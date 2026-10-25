# OptiFlow + Supabase — setup guide

## What this backend does (and does not do)

- **Auth:** Supabase Auth (email/password, email verification, password
  reset, Google OAuth if enabled, persistent sessions).
- **Private history:** Postgres tables with Row Level Security on every
  user-owned table. Ownership is enforced in the database, not just by
  hiding pages in the UI.
- **Camera stays on-device:** frames are processed in the browser.
  Only session summaries are saved by default. Pulse waveform traces
  and mesh replays are cloud-stored only when the user opts in
  (Account settings), replays in a private storage bucket.
- **No raw video is ever uploaded.**

## 1. Create the project

1. Create a project at https://supabase.com/dashboard.
2. Note the Project URL and the **publishable** key
   (Dashboard → Settings → API). Do not use the service-role key in
   the app — it bypasses RLS and must stay server-side only.

## 2. Apply the migrations

Using the Supabase CLI (recommended, versioned):

```bash
cd hacktx
supabase link --project-ref <your-project-ref>
supabase db push
```

Or paste each file in `supabase/migrations/` into the Dashboard SQL
editor, in order:

1. `20251025000001_init.sql` — profiles, scan_sessions, self_reports,
   derived_metrics, notes, activity_feedback, RLS policies, and the
   `handle_new_user()` profile trigger.
2. `20251025000002_replay_storage.sql` — private `replays` bucket +
   storage RLS policies (objects under `<user_id>/<session_id>.json`).

## 3. Configure the app

```bash
cp .env.example .env.local
# edit .env.local with your real URL + publishable key
npm install
npm run dev
```

`.env.local` is loaded by Vite and is not committed (add it to
`.gitignore` if you initialise git in this folder — this folder ships
without a git repo).

## 4. Redirects (required for email + OAuth to return to the app)

Dashboard → Authentication → URL Configuration:

- **Site URL:** your app origin, e.g. `http://localhost:5173` for local
  dev, and your deployed origin in production.
- **Redirect URLs:** add the same origin(s). The app uses
  `window.location.origin` as the redirect target for sign-up
  verification, password reset, and Google sign-in, and Supabase's JS
  client detects the session from the URL on return.

## 5. Email delivery

- **Local dev:** Supabase's built-in email works for testing, but
  delivery can be slow / rate-limited.
- **Production:** Dashboard → Authentication → SMTP — configure a
  real SMTP provider (e.g. Resend, SendGrid). Without it, verification
  and reset emails may not arrive reliably.
- **Email confirmation:** Dashboard → Authentication → Providers →
  Email → "Confirm email" — when on, sign-up shows "check your inbox"
  until the user verifies. When off, sign-up signs in immediately.
  The app handles both cases.
- **Templates:** the default templates link back to your Site URL;
  check that the link lands on the app origin, not a Supabase domain.

## 6. Optional: Google sign-in

Dashboard → Authentication → Providers → Google:

1. Create a Google Cloud OAuth client (Authorized redirect URI =
   `https://<your-project-ref>.supabase.co/auth/v1/callback`).
2. Paste the Client ID + Secret into the Supabase Google provider and
   enable it.
3. If the provider is not enabled, the app's Google button will return
   a clear error instead of silently failing — that is the expected
   behaviour until step 1–2 are done.

## 7. Account deletion — the one step browser code cannot do

Deleting a user's stored data (Account → Danger zone) removes every
row and replay object owned by that user and signs them out. Removing
the Supabase **Auth user record itself** requires a privileged key:

- Dashboard → Authentication → Users → select the user → Delete, or
- a small server-side edge function using the service-role key that
  calls `supabase.auth.admin.deleteUser(userId)` after verifying the
  requester's identity.

Do not put the service-role key in the app to work around this.

## 8. Verify isolation (manual, two-user test)

With two test accounts (A and B) and RLS applied:

1. Sign in as A, complete + save a check-in. Sign out.
2. Sign in as B — A's check-in must not appear in Today, Calendar, or
   Insights, and B's export must not contain it.
3. As B, try opening A's session by id in the app — there is no
   route that loads a session by id alone; history always comes from
   `scan_sessions where user_id = auth.uid()`.
4. In the Dashboard SQL editor, as a sanity check, confirm the
   policies exist: `select tablename, policyname from pg_policies
   where schemaname = 'public';` — every user-owned table must list
   owner-only policies, and `row_security` must be enabled.
5. Sign out as B, sign back in as A — A's history returns; account
   switching must not leak B's rows into A's view (the app clears
   cloud data from memory on sign-out).

**Automated coverage in this repo:** `src/lib/cloud.test.ts` verifies
the client-side ownership contract (user id always comes from the auth
session, never from the session object), duplicate prevention, and
opt-in stripping of waveform/replay data. It cannot verify RLS itself
— that requires a live project, which is why steps 1–5 above are
listed explicitly.

## 9. What is still unconfigured in this delivery

This delivery contains **code + migrations + docs only** — no live
Supabase project, no credentials, and no simulated backend. Until
steps 1–4 above are done, the app runs in guest/local mode and the
Account screen says so plainly. Camera, ML, rPPG, mesh replay, reports,
and research features are unchanged in that mode.
