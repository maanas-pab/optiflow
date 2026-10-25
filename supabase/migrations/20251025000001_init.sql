-- OptiFlow Supabase migration 0001 — profiles, sessions, reports, metrics,
-- notes, feedback. All tables are user-owned and RLS-protected.
-- Apply with: supabase db push   (or paste into the Dashboard SQL editor)
-- NEVER put a service-role key in the app; RLS is enforced for the
-- publishable (anon) key used by browser code.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  timezone text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles: owner read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles: owner delete" on public.profiles for delete using (auth.uid() = id);

-- Auto-create a profile row on sign-up (security definer, standard pattern).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------ scan_sessions
-- One row per check-in. session_data holds the full app Session summary
-- (score, camera metrics, self-report, suggestions, pulse BPM summary).
-- Replay geometry is NEVER stored here; it goes to private storage
-- (migration 0002) only when the user opts in. Pulse waveform traces are
-- stored only when preferences.savePulseWaveform is true (otherwise the
-- waveform array is emptied before upload — see src/lib/cloud.ts).
create table if not exists public.scan_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_session_id text not null,
  session_data jsonb not null,
  score integer,
  score_label text,
  created_at timestamptz not null,
  timezone text,
  usable_percent integer,
  valid_seconds numeric,
  measurement_version text,
  pulse_bpm integer,
  has_pulse_waveform boolean not null default false,
  has_replay boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, client_session_id)
);
create index if not exists scan_sessions_user_created_idx on public.scan_sessions (user_id, created_at desc);
alter table public.scan_sessions enable row level security;
create policy "scan_sessions: owner read"   on public.scan_sessions for select using (auth.uid() = user_id);
create policy "scan_sessions: owner insert" on public.scan_sessions for insert with check (auth.uid() = user_id);
create policy "scan_sessions: owner update" on public.scan_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "scan_sessions: owner delete" on public.scan_sessions for delete using (auth.uid() = user_id);

-- -------------------------------------------------------------- self_reports
create table if not exists public.self_reports (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_client_id text not null,
  items jsonb not null,
  kss integer check (kss is null or (kss between 1 and 9)),
  created_at timestamptz not null,
  primary key (user_id, session_client_id)
);
alter table public.self_reports enable row level security;
create policy "self_reports: owner all" on public.self_reports for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------ derived_metrics
create table if not exists public.derived_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_client_id text not null,
  metrics jsonb not null,
  ml_features jsonb,
  ml_prediction jsonb,
  created_at timestamptz not null,
  primary key (user_id, session_client_id)
);
alter table public.derived_metrics enable row level security;
create policy "derived_metrics: owner all" on public.derived_metrics for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------- notes
-- Session notes and journal entries (journal entries use session_client_id
-- null and carry their own entry id inside the note payload if needed;
-- the app's journal stays local-first and is exported from the device).
create table if not exists public.notes (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_client_id text not null,
  note text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, session_client_id)
);
alter table public.notes enable row level security;
create policy "notes: owner all" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ----------------------------------------------------------- activity_feedback
create table if not exists public.activity_feedback (
  user_id uuid not null references auth.users (id) on delete cascade,
  session_client_id text not null,
  suggestion_id text not null,
  feedback text not null check (feedback in ('helpful', 'not-for-me')),
  created_at timestamptz not null default now(),
  primary key (user_id, session_client_id, suggestion_id)
);
alter table public.activity_feedback enable row level security;
create policy "activity_feedback: owner all" on public.activity_feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
