# OptiFlow

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/hero/banner.jpg">
  <img src="assets/hero/banner.jpg" alt="OptiFlow — mountain valley banner" width="100%" />
</picture>

> **A moment to notice how you're doing.**  
> Camera-assisted wellness check-ins, processed entirely on your device. Visible facial movement, your own reports of energy and stress, and a calm next step — never a diagnosis, never a saved video.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Face%20Landmarker-blue)](https://developers.google.com/mediapipe/)

---

## What OptiFlow is

OptiFlow is a **local-first, camera-assisted wellness check-in app**. You open your webcam, sit quietly for 20–120 seconds, and the app observes what the camera sees — blink stability, eye closure, jaw and brow movement, head steadiness — and combines it with your own self-report of stress, fatigue, and energy. The result is a gentle, transparent score and a suggested reset (eye rest, paced breathing, a short walk).

**No raw video is ever saved or uploaded.** No microphone is ever requested. Face processing happens in the browser via MediaPipe, downloaded once from a CDN at first scan.

---

## What it measures (precisely)

| Observation | What it is | What it is NOT |
|-------------|------------|----------------|
| Blink count & rate | Blinks per minute during the scan | A health reading or fatigue diagnosis |
| Eye closure % | Share of valid time eyes were closed | A sleepiness score |
| Jaw opening / brow movement | Visible facial movement activity | Muscle-tension or emotion detection |
| Head steadiness | Yaw, pitch, roll variability | A neurological assessment |
| Self-report | Your own stress, fatigue, eye, jaw, energy (0–10) | Population "normals" without a source |

OptiFlow deliberately **does not** claim to detect mental illness, diagnose conditions, read emotions, or assess overall health from appearance. A neutral expression is not unhealthy; smiling is not rewarded.

---

## Feature tour

### Today — your dashboard
<img src="assets/screenshots/today.jpg" alt="Today dashboard" width="600" />

Your most recent score, a seven-day trend, a suggested reset, and a calendar preview — all local to your device.

### Scan — the check-in
<img src="assets/screenshots/scan.jpg" alt="Scan with face landmarks" width="600" />

Face landmarks overlaid on your webcam feed. Blinks, eye openness, brow movement, jaw opening, and tension tracked in real time.

### Pulse Portrait — rPPG from your webcam
<img src="assets/screenshots/pulse-portrait.jpg" alt="Pulse waveform" width="600" />

Estimated pulse from subtle skin-light changes (POS rPPG on forehead + cheek). This is **not** an ECG or contact-sensor PPG — it's experimental and unvalidated.

### Report — transparent scoring
<img src="assets/screenshots/report.jpg" alt="Session report score card" width="600" />

Every score is broken into weighted components (eye comfort, tension-related movement, blink stability, head steadiness) with a transparent formula you can inspect.

### Insights — restrained trends
<img src="assets/screenshots/insights.jpg" alt="Insights charts" width="600" />

Score over time, self-reported stress & fatigue, camera observations, and morning vs afternoon comparisons. Missing dates are never extrapolated. Associations are described, never claimed as causes.

### Calendar — daily colour code
<img src="assets/screenshots/calendar.jpg" alt="Calendar heatmap" width="600" />

Days coloured by your mean saved score. Neutral = no camera score that day.

### Reset Studio — small, usable activities
<img src="assets/screenshots/reset-studio.jpg" alt="Reset Studio activities" width="600" />

Comfortable paced breathing, quiet screen break, gentle jaw awareness, shoulder movement, grounding exercise, short walk reminder. No camera required.

### Journal — private notes
<img src="assets/screenshots/journal.jpg" alt="Journal entry" width="600" />

Lightweight private notes with mood and energy tags you choose. The app never assigns emotions to entries or faces.

---

## Research integrity — "Inside OptiFlow"

OptiFlow is built on published research, with full transparency about what is and isn't validated.

<img src="assets/screenshots/research.jpg" alt="Inside OptiFlow research page" width="600" />

Every source is tagged with its actual status — for example:

- **CogBeacon (2019)** — Research reference · Not downloaded · Not used for training · Not evaluated
- **YawDD (2014)** — Research reference · Not downloaded · Not used for training · Not evaluated
- **UBFC-rPPG** — Research reference · Not downloaded · Not used for training · Not evaluated · Future research — pulse, outside this phase

Nothing is "clinically validated," "research proven," or "AI certified." The research library shows exactly what is built, what is planned, and what has not been evaluated — with the same honesty for every source.

---

## Privacy by design

- **Frames processed on-device** in the browser; no raw video or face image saved or uploaded
- **MediaPipe model downloaded once** from a CDN at first scan — the only network call during a scan
- **Session summaries, notes, preferences** saved locally in IndexedDB
- **Export** all your summaries as JSON; **delete** all personal data anytime
- **Optional cloud sync** via Supabase with Row Level Security — your data is owned by you, isolated per user, and never mixed with anyone else's

---

## Tech stack

```
Frontend:  React 18 + TypeScript + Vite
Styling:   Custom CSS (serif headings, sans-serif body, muted palette)
Vision:    MediaPipe Face Landmarker (on-device, WebAssembly)
rPPG:      POS algorithm on forehead + cheek skin RGB
Storage:   IndexedDB (local), optional Supabase Postgres (cloud)
Tests:     Vitest
Deploy:    Vercel
```

---

## Quickstart

```bash
# Clone
git clone https://github.com/maanas-pab/optiflow.git
cd optiflow

# Install
npm install

# Run locally (camera requires localhost or HTTPS)
npm run dev
# open http://localhost:5173

# Run tests
npm test

# Build for production
npm run build
```

### Camera requirements
- Chrome, Edge, Firefox, or Safari with `getUserMedia`
- Camera permission for **video only** (no microphone)
- `localhost` or HTTPS for camera access

---

## Supabase (optional cloud sync)

OptiFlow works fully offline. To enable cloud accounts and history sync:

1. Create a project at [supabase.com](https://supabase.com/dashboard)
2. Apply the migrations in `supabase/migrations/` via the SQL Editor
3. Create `.env.local`:

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
```

4. Add your app domain to **Authentication → URL Configuration** (Site URL + Redirect URLs)
5. Run `npm run dev`

> The service-role key is never used in browser code. Row Level Security enforces ownership in the database.

---

## Project structure

```
optiflow/
├── README.md
├── assets/
│   ├── hero/banner.jpg          # Mountain valley hero banner
│   ├── screenshots/             # UI screenshots
│   └── research/                # Research/dataset screenshots
├── supabase/
│   ├── migrations/              # SQL migrations (RLS, profiles, sessions, replays)
│   └── README.md                # Supabase setup guide
├── src/
│   ├── App.tsx                  # App shell + navigation
│   ├── components/              # Charts, Halo, MetricCard, LiveGraphs
│   ├── lib/                     # camera, metrics, scoring, storage, supabase, auth
│   └── views/                   # Today, Scan, Report, Insights, Calendar, Reset Studio, Journal
├── ml/                          # Training pipeline + dataset references
├── public/                      # Static assets
└── index.html
```

---

## Code snippet: transparent scoring

```tsx
// src/lib/scoring.ts — every component weighted and explained
export function scoreSession(observations: Observations): Score {
  return {
    eyeComfort:        { weight: 0.40, value: observations.eyeOpenness },
    tensionMovement:   { weight: 0.30, value: observations.tension },
    blinkStability:    { weight: 0.15, value: observations.blinkRate },
    headSteadiness:    { weight: 0.15, value: observations.headYawPitchRoll },
  };
}
```

```ts
// src/lib/supabase.ts — publishable key only, RLS enforced server-side
export const supabase = createClient(url, publishableKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
```

---

## What this is not

- Not a medical device. Not clinically validated.
- Not "AI certified." No population normals without a documented source.
- Not emotion detection. No muscle-tension readings.

It is a **moment to notice how you're doing** — visible movement, your own words, and a calm next step.

---

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Core scan, scoring, reset studio, journal | ✅ Built |
| 2 | Research transparency ("Inside OptiFlow") | ✅ Built |
| 3 | Optional Supabase cloud sync with RLS | 🛠️ Migrations ready |
| 4 | Accessibility (keyboard nav, screen readers) | 📋 Planned |
| 5 | Additional reset activities & languages | 📋 Planned |
| 6 | Export improvements (PDF, CSV) | 📋 Planned |

Planned items are not promises — they reflect direction, not commitments.

## Verify Supabase isolation (two-user test)

With RLS applied, confirm user data never leaks:

1. Sign in as user A, complete + save a check-in. Sign out.
2. Sign in as user B — A's check-in must not appear in Today, Calendar, or Insights.
3. As B, try opening A's session by id — no route loads a session by id alone; history always comes from `scan_sessions where user_id = auth.uid()`.
4. In Supabase SQL Editor:

```sql
select tablename, rowsecurity from pg_tables where schemaname='public';
select tablename, policyname from pg_policies where schemaname='public';
```

Every user-owned table should show `rowsecurity = true` with owner-only policies.

## License

MIT. See [LICENSE](LICENSE).

---

*Built with care by Maanas Pabbathi. Camera-assisted wellness, processed on your device.*
EOF
git add README.md && git commit -m "✨ Write comprehensive aesthetic README with hero banner, feature tour, research integrity, privacy, and code snippets" 2>&1