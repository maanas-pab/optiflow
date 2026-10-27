# Deployment Guide

How this site is deployed/can be; OptiFlow is a Vite + React app that deploys easily to Vercel. It also runs fully offline via `npm run dev`.

## Option 1: Vercel (recommended)

1. Push this repo to GitHub
2. Import it in [Vercel](https://vercel.com)
3. Add environment variables in **Project Settings → Environment Variables**:

| Variable | Type | Value |
|----------|------|-------|
| `VITE_SUPABASE_URL` | Config | `https://ntkpnhpktcruuddbewwl.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Config | your anon public key |

4. Select all environments (Production, Preview, Development)
5. Deploy

### Supabase redirect URLs (required for email/OAuth)

In **Supabase Dashboard → Authentication → URL Configuration**:

- **Site URL:** `https://your-app.vercel.app`
- **Redirect URLs:** add `https://your-app.vercel.app`

## Option 2: Local development

```bash
npm install
npm run dev
# open http://localhost:5173
```

Camera requires `localhost` or HTTPS.

## Option 3: Static build

```bash
npm run build
# output in dist/
```

## Supabase setup (optional cloud sync)

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Apply migrations via SQL Editor:
   - `supabase/migrations/20251025000001_init.sql`
   - `supabase/migrations/20251025000002_replay_storage.sql`
3. Create `.env.local` (gitignored, never commit):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

4. Run `npm run dev`

## Verify deployment

- Open the app, go to Account, sign up/in
- Complete a check-in and save it
- Sign out, sign back in — cloud history should reappear
