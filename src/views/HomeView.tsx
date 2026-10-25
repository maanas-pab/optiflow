import React from 'react';
import type { Session } from '../types';
import Halo from '../components/Halo';

/**
 * OptiFlow homepage — the first thing you see when you open the app.
 *
 * The centrepiece is the user's own landscape painting (public/hero.jpg):
 * soft lavender sky, dusty-blue mountains, sage hills, butter-yellow path
 * and coral wildflowers — the exact palette OptiFlow was designed in.
 * The name sits ON the painting, not above it, with a gentle breathing
 * halo behind the text and a very slow Ken Burns drift on the image.
 * Everything else on the page is a quiet echo of that painting: the
 * path becomes the "how it works" line, the hills become soft cards.
 *
 * Motion is deliberately slow and calm (this is a wellness app, not a
 * showcase reel), and every animation is switched off by
 * prefers-reduced-motion / the Reduced motion setting.
 */
export default function HomeView({ latest, onStart, onDemo, onOpenLatest, onInside, onAccount }: {
  latest?: Session | null; onStart: () => void; onDemo: () => void;
  onOpenLatest?: () => void; onInside: () => void; onAccount: () => void;
}) {
  return (
    <div className="home">
      {/* HERO — the painting, with the name on it */}
      <section className="hero" aria-label="OptiFlow introduction">
        <div className="hero-image-wrap">
          <img className="hero-image" src="/hero.jpg" alt="Soft watercolour landscape: lavender sky over dusty-blue mountains, green hills, a winding yellow path and coral wildflowers" />
          <div className="hero-wash" aria-hidden="true" />
        </div>
        <div className="hero-halo" aria-hidden="true"><Halo /></div>
        <div className="hero-text">
          <p className="hero-eyebrow reveal" style={{ animationDelay: '.1s' }}>A moment to notice how you&rsquo;re doing</p>
          <h1 className="hero-title reveal" style={{ animationDelay: '.25s' }}>OptiFlow</h1>
          <p className="hero-sub reveal" style={{ animationDelay: '.45s' }}>
            Camera-assisted wellness check-ins, processed on your device.
            Visible movement, your own words, and a calm next step — never a diagnosis, never a saved video.
          </p>
          <div className="hero-cta reveal" style={{ animationDelay: '.65s' }}>
            <button className="btn hero-btn" onClick={onStart}>Start a check-in →</button>
            <button className="btn secondary hero-btn" onClick={onDemo}>Explore a demo</button>
          </div>
          <p className="hero-note reveal small" style={{ animationDelay: '.8s' }}>
            No account needed to scan · 20–120 second check-ins · Your face never leaves this device
          </p>
        </div>
      </section>

      {/* PATH — how it works, drawn as a winding line like the painting's path */}
      <section className="home-section reveal" style={{ animationDelay: '.2s' }}>
        <h2>Follow the path, not a scoreboard</h2>
        <p className="small muted">One short scan, four quiet steps. Nothing here judges you — it only shows you what was observed, in this moment.</p>
        <ol className="path-steps">
          <li><span className="path-dot">1</span><strong>Open the camera</strong><p className="small muted">Video only, on-device. The detailed mesh shows what the camera sees — and nothing is recorded.</p></li>
          <li><span className="path-dot">2</span><strong>Notice, in your own words</strong><p className="small muted">Optional self-report: stress, fatigue, energy, eye and jaw comfort, and — for research — sleepiness (KSS 1–9).</p></li>
          <li><span className="path-dot">3</span><strong>See what was observed</strong><p className="small muted">Blinks, eye closure, jaw and head movement, and — optionally — an experimental pulse estimate, each with its limits stated.</p></li>
          <li><span className="path-dot">4</span><strong>Take one small step</strong><p className="small muted">A reset chosen from your weakest camera component, with concrete steps — not a promise of a better score.</p></li>
        </ol>
      </section>

      {/* HILLS — four soft cards, the four pillars */}
      <section className="home-section">
        <h2>What OptiFlow is built on</h2>
        <div className="grid g4 home-pillars">
          <article className="card pillar sage"><h3>Observe</h3><p className="small">Visible events only — blinks, closure, jaw opening, head movement — with documented definitions and quality checks.</p></article>
          <article className="card pillar blue"><h3>Explain</h3><p className="small">Observed, self-reported, and estimated are kept separate, always. “Show me why” replays the mesh behind any score.</p></article>
          <article className="card pillar lav"><h3>Reflect</h3><p className="small">Compare only with your own earlier sessions, in compatible conditions. No population norms, no judgements.</p></article>
          <article className="card pillar butter"><h3>Reset</h3><p className="small">Breathing, eye rest, movement and workspace resets in a calm circular timer — then tell us if it helped.</p></article>
        </div>
      </section>

      {/* LATEST — only when there is one; otherwise an honest empty state */}
      {latest ? (
        <section className="card home-latest">
          <p className="small muted">Your most recent check-in · {new Date(latest.createdAt).toLocaleString()}</p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {latest.score !== null ? (
              <p style={{ fontSize: '3rem', fontWeight: 700, fontFamily: 'var(--serif)', margin: 0 }}>{latest.score}<span className="small">/100</span></p>
            ) : <p style={{ margin: 0 }}>Camera-observation report (no final camera score)</p>}
            <div>
              <p><span className="pill" style={{ background: latest.scoreColor ?? undefined }}>● {latest.scoreLabel ?? 'Observed'}</span></p>
              <p className="small muted">Final score — camera-derived only. Self-report is a comparison, never the final score.</p>
            </div>
            <button className="btn small secondary" onClick={onOpenLatest}>Open report →</button>
          </div>
        </section>
      ) : (
        <section className="card home-latest">
          <h3>Your first check-in is a blank page — on purpose</h3>
          <p className="small muted">Nothing here is pre-filled with fictional scans. When you complete one, your most recent score, a seven-day trend, and a suggested reset will live here.</p>
          <button className="btn small" onClick={onStart}>Start your first check-in →</button>
        </section>
      )}

      {/* FOOTER STRIP — research + account, in the painting's colours */}
      <section className="home-strip">
        <div>
          <h3>See the signals. Understand the limits.</h3>
          <p className="small">The research, datasets, methods, and honest status of every model — including the experimental pulse estimate — live in Inside OptiFlow.</p>
          <button className="btn small secondary" onClick={onInside}>Inside OptiFlow →</button>
        </div>
        <div>
          <h3>Your history, your choice</h3>
          <p className="small">Guest by default, on this device. Sign in to save privately across devices — summaries by default, pulse traces and mesh replays only if you opt in.</p>
          <button className="btn small secondary" onClick={onAccount}>Account &amp; cloud settings →</button>
        </div>
      </section>
    </div>
  );
}
