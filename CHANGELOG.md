# Changelog

## [1.0.0] — 2026-10-25

### Added
- Camera-assisted wellness check-ins (blink, eye closure, jaw, brow, head movement)
- rPPG pulse estimation from webcam (experimental)
- Transparent weighted scoring with component breakdown
- Reset Studio (breathing, screen break, jaw awareness, shoulder movement, grounding, walk)
- Journal with mood/energy tags
- Insights dashboard (score over time, stress & fatigue, camera observations, morning vs afternoon)
- Calendar heatmap of daily mean scores
- Research transparency page ("Inside OptiFlow") with dataset status tags
- Optional Supabase cloud sync with Row Level Security
- Privacy-first design: no raw video, no microphone, local-first IndexedDB

### Tech
- React 18 + TypeScript + Vite
- MediaPipe Face Landmarker
- Vitest test suite
- Supabase migrations with RLS policies
