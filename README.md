# OptiFlow

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/hero/banner.png">
  <img src="assets/hero/banner.png" alt="OptiFlow — mountain valley banner" width="100%" />
</picture>

> **A moment to notice how you're doing.**  
> Camera-assisted wellness check-ins, processed entirely on your device. Visible facial movement, your own reports of energy and stress, and a calm next step — never a diagnosis, never a saved video.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Face%20Landmarker-blue)](https://developers.google.com/mediapipe/)

---

## What OptiFlow is

OptiFlow is a local-first, camera-assisted wellness check-in app. You open your webcam, sit quietly for 20–120 seconds, and the app observes what the camera sees — blink stability, eye closure, jaw and brow movement, head steadiness — and combines it with your own reports of stress, fatigue, and energy. The result is a gentle, transparent score and a suggested reset (eye rest, paced breathing, a short walk).

**No raw video is ever saved or uploaded.** No microphone is ever requested. Face processing happens in the browser via MediaPipe.

---

## What it measures

| Observation | What it is |
|-------------|------------|
| Blink count & rate | Blinks per minute during the scan |
| Eye closure % | Share of valid time eyes were closed |
| Jaw opening / brow movement | Visible facial movement activity |
| Head steadiness | Yaw, pitch, roll variability |
| Self-report | Your own stress, fatigue, eye, jaw, energy (0–10) |

OptiFlow does **not** claim to detect mental illness, diagnose conditions, read emotions, or assess overall health from appearance. A neutral expression is not unhealthy; smiling is not rewarded.

---

## Feature tour

### Today — your dashboard
<img src="assets/screenshots/today.png" alt="Today dashboard" width="600" />

Your most recent score, a seven-day trend, a suggested reset, and a calendar preview — all local to your device.

### Scan — the check-in
<img src="assets/screenshots/scan.png" alt="Scan with face landmarks" width="600" />

Face landmarks overlaid on your webcam feed. Blinks, eye openness, brow movement, jaw opening, and tension tracked in real time.

### Pulse Portrait — rPPG from your webcam
<img src="assets/screenshots/pulse-portrait.png" alt="Pulse waveform" width="600" />

Estimated pulse from subtle skin-light changes. Experimental and unvalidated — not an ECG or contact-sensor PPG.

### Report — transparent scoring
<img src="assets/screenshots/report.png" alt="Session report score card" width="600" />

Every score is broken into weighted components (eye comfort, tension-related movement, blink stability, head steadiness) with a transparent formula you can inspect.

### Insights — restrained trends
<img src="assets/screenshots/insights.png" alt="Insights charts" width="600" />

Score over time, self-reported stress & fatigue, camera observations, and morning vs afternoon comparisons. Missing dates are never extrapolated. Associations are described, never claimed as causes.

### Calendar — daily colour code
<img src="assets/screenshots/calendar.png" alt="Calendar heatmap" width="600" />

Days coloured by your mean saved score. Neutral = no camera score that day.

### Reset Studio — small, usable activities
<img src="assets/screenshots/reset-studio.png" alt="Reset Studio activities" width="600" />

Comfortable paced breathing, quiet screen break, gentle jaw awareness, shoulder movement, grounding exercise, short walk reminder. No camera required.

### Journal — private notes
<img src="assets/screenshots/journal.png" alt="Journal entry" width="600" />

Lightweight private notes with mood and energy tags you choose. The app never assigns emotions to entries or faces.

---

## Privacy by design

- **Frames processed on-device** in the browser; no raw video or face image saved or uploaded
- **MediaPipe model downloaded once** from a CDN at first scan — the only network call during a scan
- **Session summaries, notes, preferences** saved locally in IndexedDB
- **Export** all your summaries as JSON; **delete** all personal data anytime

---

## What this is not

- Not a medical device. Not clinically validated.
- Not "AI certified."
- Not emotion detection. No muscle-tension readings.

It is a **moment to notice how you're doing** — visible movement, your own words, and a calm next step.

---

## Screenshot gallery

<p align="center">
  <img src="assets/screenshots/home.png" alt="Home" width="300" />
  <img src="assets/screenshots/today.png" alt="Today" width="300" />
  <img src="assets/screenshots/scan.png" alt="Scan" width="300" />
</p>

<p align="center">
  <img src="assets/screenshots/pulse-portrait.png" alt="Pulse Portrait" width="300" />
  <img src="assets/screenshots/report.png" alt="Report" width="300" />
  <img src="assets/screenshots/insights.png" alt="Insights" width="300" />
</p>

<p align="center">
  <img src="assets/screenshots/calendar.png" alt="Calendar" width="300" />
  <img src="assets/screenshots/reset-studio.png" alt="Reset Studio" width="300" />
  <img src="assets/screenshots/journal.png" alt="Journal" width="300" />
</p>

<p align="center">
  <img src="assets/screenshots/research.png" alt="Inside OptiFlow research" width="300" />
  <img src="assets/screenshots/datasets.png" alt="Research datasets" width="300" />
  <img src="assets/screenshots/real-time-graphs-scan.png" alt="Real-time graphs scan" width="300" />
</p>

<p align="center">
  <img src="assets/screenshots/reset-studio-example-activity.png" alt="Reset Studio example activity" width="300" />
  <img src="assets/screenshots/privacy.png" alt="Privacy" width="300" />
</p>

---

## Acknowledgments

- [MediaPipe Face Landmarker](https://developers.google.com/mediapipe/) — on-device face landmark detection
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — frontend stack

---

## License

MIT. See [LICENSE](LICENSE).

---

*Built with care by Maanas Pabbathi, Rohan Jannu, and Vihan Raval. Camera-assisted wellness, processed on your device.*
