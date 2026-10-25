import React, { useState } from 'react';
import type { JournalEntry, Session } from '../types';
import { store } from '../lib/storage';

const MOODS = ['Calm', 'Tired', 'Focused', 'Restless', 'Low energy', 'Okay', 'Bright'];
const PROMPTS = ['What felt demanding today?', 'What helped?', 'What would you like more of tomorrow?'];

export default function JournalView({ entries, sessions, onRefresh }: { entries: JournalEntry[]; sessions: Session[]; onRefresh: () => void }) {
  const [note, setNote] = useState('');
  const [mood, setMood] = useState<string[]>([]);
  const [energy, setEnergy] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');

  async function add() {
    if (!note.trim()) return;
    await store.saveJournal({ id: 'j-' + Date.now(), createdAt: new Date().toISOString(), note: note.trim(), moodTags: mood, energyTags: energy, sessionId: sessionId || undefined });
    setNote(''); setMood([]); setEnergy([]); setSessionId(''); onRefresh();
  }
  const filtered = entries.filter(e =>
    (query === '' || e.note.toLowerCase().includes(query.toLowerCase())) &&
    (filter === '' || e.moodTags.includes(filter) || e.energyTags.includes(filter))
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div>
      <h1>Journal</h1>
      <p className="muted">Private, lightweight notes. Tags are chosen by you — the app never assigns emotions to entries or faces.</p>
      <section className="card">
        <label>Write a note</label><textarea rows={4} value={note} onChange={e => setNote(e.target.value)} placeholder="A few sentences are enough." />
        <p className="small muted">Prompts: {PROMPTS.join(' · ')}</p>
        <p><strong>Mood tags (your choice):</strong></p>
        <div>{MOODS.map(m => <button key={m} className="pill" style={{ background: mood.includes(m) ? '#B9CDBB' : '#fff' }} onClick={() => setMood(mood.includes(m) ? mood.filter(x => x !== m) : [...mood, m])}>{m}</button>)}</div>
        <p style={{ marginTop: 10 }}><strong>Energy tags:</strong></p>
        <div>{['Low', 'Steady', 'High'].map(m => <button key={m} className="pill" style={{ background: energy.includes(m) ? '#BCCFDF' : '#fff' }} onClick={() => setEnergy(energy.includes(m) ? energy.filter(x => x !== m) : [...energy, m])}>{m}</button>)}</div>
        <div style={{ marginTop: 12 }}><label>Link to a scan (optional)</label><select value={sessionId} onChange={e => setSessionId(e.target.value)}><option value="">No link</option>{sessions.map(s => <option key={s.id} value={s.id}>{new Date(s.createdAt).toLocaleString()} — {s.score !== null ? `${s.score}/100` : 'camera-only'}</option>)}</select></div>
        <button className="btn" style={{ marginTop: 12 }} onClick={add}>Save journal entry</button>
      </section>
      <section className="card" style={{ marginTop: 16 }}>
        <div className="grid g2"><div><label>Search notes</label><input type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search…" /></div><div><label>Filter by tag</label><select value={filter} onChange={e => setFilter(e.target.value)}><option value="">All tags</option>{MOODS.map(m => <option key={m}>{m}</option>)}</select></div></div>
        {filtered.length === 0 ? <p className="small muted" style={{ marginTop: 10 }}>No entries match.</p> : filtered.map(e => (
          <article key={e.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
            <p className="small muted">{new Date(e.createdAt).toLocaleString()}</p><p>{e.note}</p>
            <p>{e.moodTags.map(t => <span key={t} className="tag">{t}</span>)} {e.energyTags.map(t => <span key={t} className="tag" style={{ background: '#BCCFDF' }}>{t}</span>)}</p>
            {e.sessionId && <p className="small muted">Linked to scan {new Date(sessions.find(s => s.id === e.sessionId)?.createdAt ?? '').toLocaleString()}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
