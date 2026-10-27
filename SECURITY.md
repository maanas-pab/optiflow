# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | ✅        |

## Reporting a vulnerability

OptiFlow processes camera frames entirely on-device and never uploads raw video. If you find a security concern:

- **Do not** open a public issue for security vulnerabilities
- Email the maintainer or use GitHub's private vulnerability reporting
- Include steps to reproduce and the affected component

## Security principles

- **No raw video or face images are saved** — only session summaries (scores, metrics, self-reports)
- **No microphone access** — camera permission is video-only
- **MediaPipe model loads from a CDN** at first scan — the only network call during a scan
- **Supabase (optional)** uses Row Level Security; the service-role key is never in browser code
- **Local-first** — IndexedDB storage means your data stays on your device unless you opt into cloud sync

## Disclosure

We will acknowledge receipt within 7 business days and work with you on resolution and disclosure timing.
