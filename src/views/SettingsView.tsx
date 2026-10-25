import React, { useState } from 'react';
import { store, exportAll, download } from '../lib/storage';

export default function SettingsView({ onRefresh, reducedMotion, setReducedMotion, onAccount }: {
  onRefresh: () => void; reducedMotion: boolean; setReducedMotion: (v: boolean) => void; onAccount?: () => void;
}) {
  const [msg, setMsg] = useState('');
  async function doExport() { download('optiflow-export.json', await exportAll()); setMsg('Export downloaded as JSON. It contains summaries only — no video or face images.'); }
  async function delPersonal() { if (!confirm('Delete all personal sessions, journal entries, and reset records? This cannot be undone.')) return; await store.clearPersonal(); setMsg('Personal data deleted.'); onRefresh(); }
  async function delDemo() { await store.clearDemo(); setMsg('Demo data deleted.'); onRefresh(); }
  return (
    <div>
      <h1>Settings &amp; Privacy</h1>
      {onAccount && <p><button className="btn secondary" onClick={onAccount}>Open Account &amp; cloud settings →</button></p>}
      <section className="card"><h2>Local-first privacy</h2>
        <ul>
          <li>Camera frames are processed on-device in your browser. Raw video and face images are never uploaded or saved.</li>
          <li>Only session summaries, voluntary responses, preferences, and notes are saved, in IndexedDB on this browser/device.</li>
          <li>Browser storage can be cleared by the browser and is specific to this browser/device — it does not follow you to another device.</li>
          <li>External downloads: on first scan, MediaPipe WebAssembly files and the Face Landmarker model are downloaded from a CDN (see <code>src/lib/mediapipe.ts</code>). The app therefore does make network requests for those model files; it makes no request that uploads your video.</li>
          <li>No account is required for the core experience. No analytics values from sessions are logged.</li>
          <li>Every camera track is stopped when a scan ends, is cancelled, or you leave the scan screen.</li>
        </ul>
      </section>
      <section className="card" style={{ marginTop: 16 }}><h2>Accessibility</h2>
        <label><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} /> Reduced motion (also honoured automatically via prefers-reduced-motion)</label>
        <p className="small muted">Colour is never the only way a result is communicated: every coloured result also carries a label and, where relevant, an icon.</p>
      </section>
      <section className="card" style={{ marginTop: 16 }}><h2>Your data</h2>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn" onClick={doExport}>Export my data (JSON)</button>
          <button className="btn secondary" onClick={delPersonal}>Delete all personal data</button>
          <button className="btn secondary" onClick={delDemo}>Delete demo data</button>
        </div>
        {msg && <p role="status">{msg}</p>}
        <p className="small muted">If you report persistent or concerning symptoms, consider consulting a qualified professional. OptiFlow does not diagnose or treat.</p>
      </section>
    </div>
  );
}
