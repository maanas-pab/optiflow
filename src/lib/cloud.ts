import type { Session, MeshReplay, UserPreferences } from '../types';
import { supabase } from './supabase';

/**
 * Cloud layer (Supabase PostgREST + Storage).
 *
 * OWNERSHIP RULE (defence in depth, RLS is the real enforcement):
 * Every row written here sets `user_id` from the CURRENT Supabase auth
 * session — never from the Session object, never from a query param,
 * never from local storage. Every read is additionally filtered by
 * `user_id = auth.uid()` in the database policies, so even if client
 * code were bypassed, another user's rows cannot be read, updated, or
 * deleted through the publishable key.
 *
 * WHAT IS SAVED BY DEFAULT: session summaries (score, camera metrics,
 * self-report, derived metrics, ML features, suggestions, note, pulse
 * BPM summary). WHAT IS NOT SAVED BY DEFAULT: raw video (never),
 * pulse waveform traces (only when preferences.savePulseWaveform),
 * mesh replay (only when preferences.saveReplay, and then only as a
 * JSON object in PRIVATE storage, never inside the session row).
 * Camera processing stays on-device regardless of sign-in state.
 *
 * DUPLICATE PREVENTION: scan_sessions has UNIQUE(user_id,
 * client_session_id). Upserts use that key, so re-saving or re-importing
 * the same local session updates it instead of creating a duplicate.
 * Import skips demo sessions entirely.
 */

export const DEFAULT_PREFERENCES: UserPreferences = {
  cloudSave: true, savePulseWaveform: false, saveReplay: false, reducedMotion: false,
};

export function requireUserId(): string {
  if (!supabase) throw new Error('Supabase is not configured.');
  // supabase-js getUser is async; callers use the AuthProvider's user id.
  throw new Error('Use cloud functions with an explicit user id from AuthProvider.');
}

/** Build the cloud-safe copy of a session for the session row. */
export function buildCloudSessionData(session: Session, prefs: UserPreferences): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...session };
  delete copy.replay; // replay goes to private storage only, if enabled
  delete copy.cloud;  // load-time metadata only
  if (session.pulse && !prefs.savePulseWaveform) {
    copy.pulse = { ...session.pulse, waveform: [] };
  }
  return copy;
}

/** Sessions eligible for import: personal (not demo), not already in cloud. */
export function importCandidates(local: Session[], cloudIds: Set<string>): Session[] {
  return local.filter(s => !s.isDemo && !cloudIds.has(s.id));
}

/** Merge cloud + local sessions: cloud wins on id conflict; local-only
 *  sessions are kept and marked unsynced (never hidden, never duplicated). */
export function mergeSessions(cloud: Session[], local: Session[]): Session[] {
  const byId = new Map<string, Session>();
  for (const s of local) byId.set(s.id, { ...s, cloud: { synced: false, hasReplay: Boolean(s.replay), hasPulseWaveform: Boolean(s.pulse?.waveform?.length) } });
  for (const s of cloud) byId.set(s.id, { ...s, cloud: { synced: true, hasReplay: s.cloud?.hasReplay ?? false, hasPulseWaveform: s.cloud?.hasPulseWaveform ?? false } });
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface CloudSessionRow {
  user_id: string; client_session_id: string; session_data: Session;
  score: number | null; score_label: string | null; created_at: string;
  timezone: string; usable_percent: number; valid_seconds: number;
  measurement_version: string | null; pulse_bpm: number | null;
  has_pulse_waveform: boolean; has_replay: boolean;
}

export function sessionToRow(session: Session, userId: string, prefs: UserPreferences, tz: string): CloudSessionRow {
  return {
    user_id: userId,
    client_session_id: session.id,
    session_data: buildCloudSessionData(session, prefs) as unknown as Session,
    score: session.score, score_label: session.scoreLabel,
    created_at: session.createdAt, timezone: tz,
    usable_percent: session.camera.usablePercent, valid_seconds: session.camera.validSeconds,
    measurement_version: session.camera.measurementVersion ?? null,
    pulse_bpm: session.pulse?.bpm ?? null,
    has_pulse_waveform: Boolean(prefs.savePulseWaveform && session.pulse?.waveform?.length),
    has_replay: Boolean(prefs.saveReplay),
  };
}

function rowToSession(row: { session_data: Session; has_replay: boolean; has_pulse_waveform: boolean }): Session {
  const s = row.session_data;
  return { ...s, cloud: { synced: true, hasReplay: row.has_replay, hasPulseWaveform: row.has_pulse_waveform } };
}

export async function fetchCloudSessions(userId: string): Promise<Session[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('scan_sessions')
    .select('session_data, has_replay, has_pulse_waveform')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToSession);
}

export async function saveCloudSession(session: Session, userId: string, prefs: UserPreferences, replay?: MeshReplay): Promise<{ saved: boolean; replaySaved: boolean }> {
  if (!supabase) throw new Error('Supabase is not configured.');
  if (session.isDemo) return { saved: false, replaySaved: false };
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const row = sessionToRow(session, userId, prefs, tz);
  const { error } = await supabase
    .from('scan_sessions')
    .upsert(row, { onConflict: 'user_id,client_session_id' });
  if (error) throw new Error(error.message);
  // Self-report + derived metrics as separate, queryable rows (same upsert key).
  await supabase.from('self_reports').upsert({
    user_id: userId, session_client_id: session.id, items: session.selfReport,
    kss: session.selfReport.kss ?? null, created_at: session.createdAt,
  }, { onConflict: 'user_id,session_client_id' });
  await supabase.from('derived_metrics').upsert({
    user_id: userId, session_client_id: session.id, metrics: session.camera,
    ml_features: session.mlFeatures ?? null, ml_prediction: session.mlPrediction ?? null,
    created_at: session.createdAt,
  }, { onConflict: 'user_id,session_client_id' });
  if (session.note) {
    await supabase.from('notes').upsert({
      user_id: userId, session_client_id: session.id, note: session.note, created_at: session.createdAt,
    }, { onConflict: 'user_id,session_client_id' });
  }
  for (const [suggestionId, v] of Object.entries(session.feedback ?? {})) {
    await supabase.from('activity_feedback').upsert({
      user_id: userId, session_client_id: session.id, suggestion_id: suggestionId, feedback: v,
    }, { onConflict: 'user_id,session_client_id,suggestion_id' });
  }
  let replaySaved = false;
  if (prefs.saveReplay && replay) {
    const path = `${userId}/${session.id}.json`;
    const { error: upErr } = await supabase.storage.from('replays').upload(path, new Blob([JSON.stringify(replay)], { type: 'application/json' }), { upsert: true, contentType: 'application/json' });
    if (upErr) throw new Error(`Replay upload failed: ${upErr.message}`);
    replaySaved = true;
  }
  return { saved: true, replaySaved };
}

export async function loadCloudReplay(session: Session, userId: string): Promise<MeshReplay | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.storage.from('replays').download(`${userId}/${session.id}.json`);
  if (error || !data) return null;
  try { return JSON.parse(await data.text()) as MeshReplay; } catch { return null; }
}

export async function deleteCloudSession(sessionId: string, userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  // RLS ensures only this user's rows can be deleted, even if the id
  // were another user's — the eq(user_id) filter is belt-and-braces.
  await supabase.from('scan_sessions').delete().eq('user_id', userId).eq('client_session_id', sessionId);
  await supabase.from('self_reports').delete().eq('user_id', userId).eq('session_client_id', sessionId);
  await supabase.from('derived_metrics').delete().eq('user_id', userId).eq('session_client_id', sessionId);
  await supabase.from('notes').delete().eq('user_id', userId).eq('session_client_id', sessionId);
  await supabase.from('activity_feedback').delete().eq('user_id', userId).eq('session_client_id', sessionId);
  await supabase.storage.from('replays').remove([`${userId}/${sessionId}.json`]);
}

export async function deleteAllCloudData(userId: string): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  for (const table of ['activity_feedback', 'notes', 'derived_metrics', 'self_reports', 'scan_sessions']) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  const { data } = await supabase.storage.from('replays').list(userId);
  if (data?.length) await supabase.storage.from('replays').remove(data.map(f => `${userId}/${f.name}`));
  await supabase.from('profiles').delete().eq('id', userId);
}

/** Load or create the user's profile + preferences. */
export async function loadPreferences(userId: string, email?: string): Promise<UserPreferences> {
  if (!supabase) return DEFAULT_PREFERENCES;
  const { data } = await supabase.from('profiles').select('display_name, preferences').eq('id', userId).maybeSingle();
  if (!data) {
    await supabase.from('profiles').upsert({ id: userId, display_name: email?.split('@')[0] ?? null, preferences: DEFAULT_PREFERENCES }, { onConflict: 'id' });
    return DEFAULT_PREFERENCES;
  }
  return { ...DEFAULT_PREFERENCES, ...(data.preferences as Partial<UserPreferences> ?? {}), displayName: data.display_name ?? undefined };
}

export async function savePreferences(userId: string, prefs: UserPreferences): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { displayName, ...rest } = prefs;
  const { error } = await supabase.from('profiles').upsert({ id: userId, display_name: displayName ?? null, preferences: rest }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}
