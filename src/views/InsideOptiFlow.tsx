import React, { useState } from 'react';
import Halo from '../components/Halo';
import { PAPERS, REPOS, DATASETS } from '../lib/catalogData';

/**
 * Inside OptiFlow — route /inside-optiflow (View 'inside').
 * Headline from the kit: "See the signals. Understand the limits."
 *
 * Status discipline (from TRAINING_RUNBOOK.md §7):
 * - Research reference: cited, not used to train or validate anything.
 * - Integrated: actually used and pinned (only MediaPipe tasks-vision today).
 * - Used for training / Evaluated: only with a run manifest / evaluation
 *   report. None exists yet, so every dataset shows Research reference
 *   + not downloaded + not used for training + not evaluated.
 * - Planned: Pulse Portrait / rPPG work — explicitly a FUTURE phase,
 *   not implemented here. No pulse feature is in this build.
 * A citation alone never triggers "trained" or "validated".
 */
export default function InsideOptiFlow() {
  const [q, setQ] = useState('');
  const [section, setSection] = useState('approach');
  const query = q.trim().toLowerCase();
  const papers = PAPERS.filter(p =>
    !query || [p.title, p.authors.join(' '), String(p.year ?? ''), p.note].join(' ').toLowerCase().includes(query));
  const pulseIds = ['ubfc-rppg', 'cohface'];
  const sections = [
    ['approach', 'Our approach'], ['how', 'How it works'], ['pulse', 'Pulse Portrait'], ['research', 'Research'],
    ['data', 'Datasets'], ['opensource', 'Open source'], ['validation', 'Validation & limitations'], ['privacy', 'Privacy'],
  ] as const;

  return (
    <div>
      <section className="card halo-wrap" style={{ overflow: 'hidden' }}>
        <Halo />
        <div style={{ position: 'relative' }}>
          <p className="muted">Science, design, and evidence</p>
          <h1 style={{ fontSize: '2.4rem' }}>See the signals. Understand the limits.</h1>
          <p>Explore the research behind OptiFlow, the experience we are building, and how we plan to test it.</p>
          <p><span className="pill" style={{ background: '#C9C2DD' }}>● Development status: Research and implementation plan</span></p>
          <p className="small muted">Not “clinically validated”, not “research proven”, not “AI certified”. This page shows what is actually built, what is only planned, and what has not been evaluated — with the same honesty for every source below.</p>
        </div>
      </section>

      <nav aria-label="Inside OptiFlow sections" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
        {sections.map(([id, label]) => <button key={id} className={`btn small ${section === id ? '' : 'secondary'}`} onClick={() => setSection(id)}>{label}</button>)}
      </nav>

      {section === 'approach' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Our approach</h2>
          <p>OptiFlow's intended contribution is: <strong>observable facial signals, understandable model estimates, personal confirmation, and useful feedback over time.</strong></p>
          <div className="grid g4">
            <div className="card"><h3>Observe</h3><p className="small">Measure visible events — blinks, eye closure, jaw opening, head movement — with documented definitions and quality checks.</p></div>
            <div className="card"><h3>Explain</h3><p className="small">Separate measured observations, your responses, and model estimates. Show where each result came from.</p></div>
            <div className="card"><h3>Reflect</h3><p className="small">Invite you to confirm how you feel and compare compatible check-ins over time.</p></div>
            <div className="card"><h3>Reset</h3><p className="small">Offer a small activity and collect feedback about whether it helped.</p></div>
          </div>
          <h3>What we are contributing</h3>
          <p className="small">Our work is the complete experience — an understandable signal view, a clear explanation of each observation, personal comparisons over time, and feedback about activities you find helpful — plus careful integration and testing of the foundations below. The underlying research belongs to the scientists and open-source communities credited here; their inclusion does not imply endorsement of OptiFlow, and we do not claim to be globally first or unique.</p>
          <h3>Pulse Portrait — experimental, integrated as POS rPPG</h3>
          <p className="small">Pulse Portrait is now an experimental, optional feature in OptiFlow: a camera-derived pulse estimate (POS rPPG, <code>optiflow-pos-v1</code>) rendered as a waveform and a rate-based halo. Remote photoplethysmography (rPPG) is established research; OptiFlow's contribution is the integration of pulse visualization, visible facial events, and traceable explanations — <strong>not</strong> the invention of rPPG. No accuracy is claimed: no OptiFlow pulse evaluation against a reference device has been run yet.</p>
        </section>
      )}

      {section === 'how' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>How it works</h2>
          <p>Camera → quality checks → facial features → trained model, when available → user confirmation → history and suggestions.</p>
          <ol>
            <li><strong>Camera (video only):</strong> MediaPipe Face Landmarker runs on-device; no raw video is saved.</li>
            <li><strong>Quality checks:</strong> exactly one face, usable-frame %, effective sampling rate, interruptions, and valid time (elapsed, capped gaps). Unusable frames are excluded, never imputed as observations.</li>
            <li><strong>Facial features (optiflow-features-v2):</strong> bilateral and unilateral blink events, blink rate per valid minute, blink duration (only at ≥10 Hz sampling), eye-closure fraction, jaw-opening events, head summaries, tracking coverage. See Metric Library for definitions.</li>
            <li><strong>Trained model, when available:</strong> currently none — the KSS sleepiness estimate is suppressed and the UI says “Model evaluation pending.” When a model exists, its version, features, and evaluation will be shown.</li>
            <li><strong>User confirmation:</strong> your KSS answer is collected <em>before</em> any prediction is shown, so a prediction cannot anchor it. Corrections are saved for later retraining; they do not instantly retrain anything.</li>
            <li><strong>History and suggestions:</strong> transparent, rule-based suggestions from camera numbers and your reported needs — not inferred diagnoses.</li>
          </ol>
          <p className="small muted">Output badges used across the app: <strong>Observed</strong> = derived from camera/task measurements · <strong>Self-reported</strong> = entered by you · <strong>Estimated</strong> = produced by an identified model with an evidence record. Quality coverage is not prediction confidence.</p>
        </section>
      )}

      {section === 'pulse' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Pulse Portrait — what runs, and what does not</h2>
          <p className="small">Method in this build: <strong>POS rPPG (optiflow-pos-v1)</strong> — forehead + cheek skin RGB means sampled from raw video only, resampled to 30 Hz, detrended, POS-projected, band-limited to 0.7–4.0 Hz (42–240 BPM), BPM from the spectral peak, accepted only with SNR ≥ 2.0 and motion/illumination/coverage gates. 10 s windows, re-analysed every 2 s. The waveform shown is the filtered pulse-related signal in normalized amplitude — it is not an ECG curve and not a contact-sensor PPG waveform. The live halo is rate-based (it pulses at the accepted BPM); it is not beat-synchronised to individual heartbeats.</p>
          <h3>References and credits</h3>
          <ul>
            <li className="small"><strong>MTTS-CAN</strong> — Liu, Fromm, Patel, McDuff, “Multi-Task Temporal Shift Attention Networks for On-Device Contactless Vitals Measurement”, NeurIPS 2020, <a href="https://arxiv.org/abs/2006.03790" target="_blank" rel="noreferrer">arXiv:2006.03790</a>, code <a href="https://github.com/xliucs/MTTS-CAN" target="_blank" rel="noreferrer">github.com/xliucs/MTTS-CAN</a>. <strong>Status: Research reference — not integrated.</strong> No MTTS-CAN code or weights are shipped in OptiFlow, and no MTTS-CAN paper accuracy is quoted as OptiFlow accuracy. A browser-ready MTTS-CAN implementation (weights, exact preprocessing, derivative-vs-waveform postprocessing) was not verified in this build, so it remains a future evaluated model, not a current component.</li>
            <li className="small"><strong>UW reference experience</strong> — <a href="https://vitals.cs.washington.edu/" target="_blank" rel="noreferrer">vitals.cs.washington.edu</a>. <strong>Status: UX reference only — not integrated.</strong> It informed the “sit still, face the camera” capture experience; its code and any server/in-browser split are not used in OptiFlow.</li>
            <li className="small"><strong>rppg-web browser demo</strong> — <a href="https://github.com/ubicomplab/rppg-web" target="_blank" rel="noreferrer">github.com/ubicomplab/rppg-web</a>. <strong>Status: UX reference only — not integrated.</strong> No code from it is copied into OptiFlow.</li>
            <li className="small"><strong>rPPG-Toolbox</strong> — <a href="https://github.com/ubicomplab/rPPG-Toolbox" target="_blank" rel="noreferrer">github.com/ubicomplab/rPPG-Toolbox</a>. <strong>Status: Benchmarking reference — not integrated.</strong> It is the future evaluation route (same held-out data, same MAE protocol) for comparing POS against neural models, once authorised UBFC-rPPG/PURE data is obtained.</li>
            <li className="small"><strong>POS method</strong> — Wang et al., “Algorithmic Principles of Remote PPG”, IEEE Trans. Biomed. Eng. 2017. <strong>Status: Integrated, experimental (optiflow-pos-v1).</strong> Implemented from the published method in <code>src/lib/rppg.ts</code> and <code>ml/rppg.py</code>, not copied from another project's code.</li>
          </ul>
          <p className="small muted">Pulse sensing is kept separate from sleepiness predictions and self-report scores. It is not used to infer stress, blood pressure, oxygen saturation, or cardiovascular health. Datasets UBFC-rPPG and COHFACE remain research references, not downloaded, not used for training, not evaluated — pulse evaluation is pending.</p>
        </section>
      )}

      {section === 'research' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Research library</h2>
          <p className="small muted">21 entries from the builder kit catalog. A source listed here is not automatically a source used to train the application. Search by title, author, year, or topic.</p>
          <label>Search the research library</label>
          <input type="text" value={q} onChange={e => setQ(e.target.value)} placeholder="e.g. blink, Karolinska, drowsiness, PPG" />
          <p className="small muted">{papers.length} of {PAPERS.length} shown.</p>
          {papers.map(p => (
            <article key={p.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
              <h3>{p.title} {p.year ? `(${p.year})` : ''}</h3>
              <p className="small muted">{p.authors.join(', ')}</p>
              <p className="small">{p.note}</p>
              <p className="small"><span className="pill" style={{ background: '#BCCFDF' }}>● {p.status}</span> <a href={p.url} target="_blank" rel="noreferrer">View source →</a></p>
            </article>
          ))}
          {papers.length === 0 && <p>No papers match that search.</p>}
        </section>
      )}

      {section === 'data' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Datasets</h2>
          <p className="small muted">All six requested sources. Download status is separate from usage status: a downloaded dataset has not necessarily trained a model. No local file paths or private consent records are shown here.</p>
          {DATASETS.map(d => (
            <article key={d.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
              <h3>{d.name} {d.year ? `(${d.year})` : ''}</h3>
              <p className="small muted">{d.researchers.join(', ')} · {d.origin}</p>
              <p className="small"><strong>Data:</strong> {d.data}</p>
              <p className="small"><strong>Labels:</strong> {d.labels}</p>
              <p className="small"><strong>Proposed role:</strong> {d.role}</p>
              <p className="small"><strong>Limitation:</strong> {d.limitation}</p>
              <p className="small"><strong>Access:</strong> {d.access}</p>
              <p className="small"><strong>Rights:</strong> {d.rights}</p>
              <p className="small">
                <span className="pill" style={{ background: '#BCCFDF' }}>● Research reference</span>{' '}
                <span className="pill">● Not downloaded</span>{' '}
                <span className="pill">● Not used for training</span>{' '}
                <span className="pill">● Not evaluated</span>{' '}
                {pulseIds.includes(d.id) && <span className="pill" style={{ background: '#E5BAA8' }}>● Future research — pulse, outside this phase</span>}
              </p>
              <p className="small"><a href={d.url} target="_blank" rel="noreferrer">Official source / access →</a></p>
            </article>
          ))}
        </section>
      )}

      {section === 'opensource' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Open-source credits</h2>
          <p className="small muted">OptiFlow builds on the credited researchers and open-source contributors. Inclusion does not imply their endorsement. Only MediaPipe tasks-vision is actually integrated today, pinned at @mediapipe/tasks-vision@0.10.14; the training pipeline in ml/ uses Python standard library only (sklearn/ONNX are research references for a future export route, not current dependencies).</p>
          {REPOS.map(r => (
            <article key={r.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
              <h3>{r.name}</h3>
              <p className="small muted">Maintainers: {r.maintainers}</p>
              <p className="small"><strong>Role:</strong> {r.role}</p>
              <p className="small"><strong>Note:</strong> {r.limitation}</p>
              <p className="small"><span className="pill" style={{ background: r.integrated ? '#B9CDBB' : '#BCCFDF' }}>● {r.status}{r.integrated ? ' — @mediapipe/tasks-vision@0.10.14' : ''}</span> <a href={r.url} target="_blank" rel="noreferrer">Repository →</a></p>
            </article>
          ))}
        </section>
      )}

      {section === 'validation' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Methodology and validation</h2>
          <ol>
            <li>Define a specific target and original label scale (KSS 1–9 for desk sleepiness; RLDD classes, YawDD events, and CogBeacon reports kept separate).</li>
            <li>Measure events and compare them with authorized annotations.</li>
            <li>Collect genuine self-reports separately from predictions — KSS before any prediction.</li>
            <li>Split participants and recordings before creating windows; overlapping windows and augmented copies stay in the same split.</li>
            <li>Compare simple and advanced models on untouched data (constant baseline first, then ridge regression).</li>
            <li>Test browser parity, rejection behavior, and device conditions.</li>
            <li>Publish limitations and measured results as they become available.</li>
          </ol>
          <p><strong>Model evaluation pending.</strong></p>
          <p className="small">No OptiFlow model has been trained on human data yet, so there are no OptiFlow accuracy numbers to show — and none are borrowed from papers. The kit's synthetic fixture checks (3,225 rows, 10 scenarios) validate code behavior only, not human measurement or fatigue-prediction accuracy. Missing data is represented as null in features, never 0-filled; the training pipeline imputes only from training participants. Later-session personalization will be evaluated separately from unseen-person generalization once real data exists. When a real evaluation exists, this section will show endpoint, real participant count, source, split, metric, uncertainty, rejection coverage, model version, and date.</p>
          <p className="small muted">Also verified in code, not on people: measurement unit tests, split-isolation logic in ml/train.py, and browser/Python golden parity (both give 7.5 on the same golden input).</p>
        </section>
      )}

      {section === 'privacy' && (
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Privacy</h2>
          <p><strong>Verified in this build:</strong> frames are processed on-device in the browser; only session summaries, voluntary answers, and notes are stored in IndexedDB; no raw video or face image is saved or uploaded; every camera track is stopped when a scan ends or is cancelled; the MediaPipe model is downloaded from a CDN on first use (that download is the only network call for the scan itself); Settings offers export (all summaries as JSON) and deletion of all personal data.</p>
          <p className="small muted">Design requirements, not yet implemented as separate controls: per-session deletion from the report view (currently all-personal-data deletion only), and a private acquisition manifest for any future external dataset (terms, checksum, version — never shown on this public page). On-device processing and anonymity are different claims: summaries are stored locally, but they are still your data, which is why export and delete exist.</p>
        </section>
      )}
    </div>
  );
}
