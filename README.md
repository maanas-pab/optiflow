# OptiFlow — “A moment to notice how you’re doing.”

A polished, local-first web app for camera-assisted wellness check-ins.
It uses only a computer and webcam. No Arduino, LEDs, external hardware,
or Python server is involved.

## What it measures — precisely

- **Camera-derived facial movement observations:** blink count and rate,
  eye-closure proportion, jaw-opening and brow movement activity,
  head yaw / pitch / roll and movement variability. These are observations
  of visible movement, not diagnoses, emotions, muscle-tension readings,
  or health assessments.
- **Changes compared with your own previous sessions** — never population
  “normal ranges” without a documented source.
- **Your own reports** of stress, fatigue, eye discomfort, jaw discomfort,
  and energy.
- **Practical opportunities** to pause, rest, or adjust your workspace.

It does **not** claim to detect mental illness, diagnose conditions, read
emotions, measure muscle tension directly, or assess overall health from
appearance. A neutral expression is not unhealthy, and smiling is not
rewarded. Jaw movement is not presented as proof of jaw clenching.
Blendshape values are model coefficients, not probabilities of an emotion
or direct muscle-activation measurements.

## Run it

```bash
cd hacktx
npm install
npm run dev
# open the printed localhost URL (camera requires localhost or HTTPS)
npm test
npm run build
```

### Camera requirements

- A browser with `getUserMedia` (current Chrome, Edge, Firefox, or Safari).
- Camera permission for **video only** — the app never requests a microphone.
- The MediaPipe Face Landmarker model and WebAssembly files are downloaded
  from a CDN at first scan time (see `src/lib/mediapipe.ts`). That is the
  only network download the scan needs. No raw video or face image is ever
  uploaded or saved. Only session summaries, voluntary responses,
  preferences, and notes are saved, in IndexedDB on this device/browser.

## How a check-in works

1. **Consent & camera setup** — what is measured, on-device processing,
   what summaries are saved, and that you can stop the camera at any time.
2. **Optional self-report** — stress, fatigue, energy, eye and jaw
   discomfort, plus mood, focus, calm, headache, and neck/shoulder tension
   (all 0–10), plus optional sleep, screen time, activity, and a note.
   Every question is skippable, and the scan, live panel, and report all
   have access to the same answers.
3. **Baseline (about 5 seconds)** — a comfortable reference pose used to
   calibrate blink and movement thresholds. This is a calibration aid, not
   a clinically meaningful personal baseline.
4. **Live scan** — 20, 30, 45, 50, 60, or 120 seconds of *valid* observation
   (60 seconds default). Frames are excluded when the face is lost,
   significantly occluded, or multiple faces are detected. Real-time graphs
   show blink count, eye openness, brow and jaw movement, tension-related
   movement, and eyes-closed %, each in its own colour, plus live fatigue /
   energy levels.
5. **Report** — a transparent score (when enough self-report is present),
   a colour-matched indicator list for mood, energy, fatigue, stress, eye
   and jaw discomfort, focus, calm, headache, neck tension, and camera
   movement/appearance observations, personal comparison, day-average
   colouring, and explainable suggestions.

### A note on the expanded indicators (important)

The scan now tracks the visible signs you asked about — raised eyebrows,
forehead furrows, brow tension, heavy-eyelid proxy (eye openness), altered
blink/gaze behaviour, jaw movement and tightness — as *movement
observations*, colour-matched to the score spectrum. It also samples
under-eye vs cheek pixels, but only as an *experimental relative change
vs your own baseline in the same lighting*, with no colour band assigned.

What it deliberately does **not** do: measure stress, fatigue, mood,
emotion, muscle tension, tense fascia, dark circles, red/puffy/swollen
eyes, paleness, dullness, jaw clenching, or teeth grinding. A normal
webcam, lighting, and skin tone make those unreliable as absolute
measurements, and many of them are feelings or conditions only you (or a
clinician) can establish. Self-report stays the authority for how you
feel; camera-derived energy is exactly `100 − fatigue indicator`, and
your self-reported energy takes precedence when present. See
`src/lib/indicators.ts` and the Metric Library for the method and limit
of every indicator.

## The final score (0–100) — camera-derived, independent of self-report

The **final score shown to the user is the camera-derived score only**.
It is computed in `src/lib/cameraScore.ts` from CameraMetrics alone, so
it never reads anything the user typed. Two scans with identical camera
data but different self-reports get the identical final score.

```
camera score = Eye comfort × 40% + Tension-related movement comfort × 30%
             + Blink stability × 15% + Head steadiness × 15%
```

Each component is 0–100, averaged over the whole scan (never a single
frame), with baseline-calibrated blink thresholds, hysteresis blink
counting, unusable frames excluded, and time from frame timestamps.
Experimental pixel appearance change is deliberately excluded from the
score because it is lighting-dominated. No score is given under 10s
valid observation or 30% usable frames; short scans are flagged lower
confidence. Weights and neutral ranges are product conventions, not
validated clinical thresholds, and the score is a movement-observation
score — not a stress, fatigue, mood, or health measurement.

The self-report score is kept **only as a comparison** in the report.
For the four core items (stress, fatigue, eye discomfort, jaw discomfort),
each rated 0–10, with at least three completed:

```
self-report score = round(100 × (1 − mean(completed item ratings) / 10))
```

The report shows both scores, their difference, and “things you might
not have noticed” — camera changes vs your own previous session — so a
difference is informative rather than confusing. If the camera was not
used, there is no final score; the self-report score is shown as a
comparison only and is never substituted as the final score.

Colour bands are product conventions, not validated clinical thresholds:

| Score | Label | Colour |
|---|---|---|
| 80–100 | Feeling comfortable | Muted sage |
| 60–79 | Some discomfort | Dusty blue |
| 40–59 | A pause may help | Soft lavender |
| 20–39 | Consider a reset | Butter yellow |
| 0–19 | Make room for rest | Muted peach |

## Demo mode

From Today, “Explore a demo” shows a clearly labelled demo dashboard,
report, and calendar. Demo records live in a separate IndexedDB store and
are **never** mixed into your personal history. Demo data is fictional
and is only for exploring the interface without a camera.

## Privacy & storage

- Frames are processed on-device; raw video and face images are not saved.
- Persistence is IndexedDB (`optiflow-db`, stores: `sessions`,
  `journal`, `resets`, `demoSessions`). Browser storage is per-browser
  and can be cleared by the browser.
- Settings & Privacy offers JSON export and full deletion of personal
  data (demo data deleted separately).
- Every camera track is stopped when a scan ends, is cancelled, or the
  scan screen is left. See `src/lib/camera.ts` and its test.

## Project structure

```
src/
  main.tsx            entry, design tokens via index.css
  App.tsx             navigation, routing, demo banner, halo shell
  index.css           tokens, halo, cards, forms, responsive layout
  types.ts            shared types
  lib/
    camera.ts         getUserMedia lifecycle, device listing, cleanup
    mediapipe.ts      Face Landmarker loading, EAR, head pose, mesh
    metrics.ts        blink counting with hysteresis, valid time,
                      aggregation, daily aggregation
    scoring.ts        transparent 0–100 score + bands
    recommendations.ts inspectable suggestion rules
    storage.ts        IndexedDB wrapper, export/delete
    demo.ts           clearly-labelled demo sessions
    resetActivities.ts Reset Studio catalogue
  lib/*.test.ts       blink, valid-time, score, missing values,
                      daily aggregation, camera cleanup
  components/
    Halo.tsx          ambient watercolor halo (score-coloured)
    Charts.tsx        small dependency-free SVG charts
    MetricCard.tsx    metric card with source + limitations
  views/
    Today.tsx  ScanFlow.tsx  ReportView.tsx  CalendarView.tsx
    InsightsView.tsx  ResetStudio.tsx  JournalView.tsx
    MetricLibrary.tsx  SettingsView.tsx
```

## Accessibility

Keyboard accessible, visible focus states, labels and icons alongside
every colour result, reduced-motion support (`prefers-reduced-motion`
and a Settings toggle), responsive layout, and no guilt-based streaks.

If you report persistent or concerning symptoms, the report suggests
consulting a qualified professional. This app is not a substitute for
professional advice.

## Supabase backend (accounts + private cloud history)

OptiFlow now ships with a Supabase backend layer, but **no live project
is configured in this delivery** — without `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local`, the app runs in
guest/local mode (IndexedDB only) and the Account screen says so.

- Auth: email/password, email verification, password reset, Google
  OAuth (if enabled in the project), persistent sessions.
- Private history: Postgres + Row Level Security on every user-owned
  table (see `supabase/migrations/`). UI route protection alone is not
  relied on.
- Camera stays on-device; summaries are saved by default, pulse
  waveform traces and mesh replays only when the user opts in.
- Guest scanning is preserved; local sessions can be imported after
  sign-in, with duplicate prevention, and are never silently assigned
  to an account.
- Full setup: redirects, email/SMTP, Google provider, account-deletion
  limits, and the two-user isolation checklist — see
  `supabase/README.md` and `.env.example`.
