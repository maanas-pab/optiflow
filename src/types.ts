export type View =
  | 'home' | 'today' | 'scan' | 'calendar' | 'insights' | 'reset' | 'journal'
  | 'library' | 'settings' | 'report' | 'inside' | 'account';

/** Cloud sync metadata attached at load time — never trusted as proof of
 *  ownership on its own; the database enforces ownership with RLS. */
export interface CloudMeta {
  synced: boolean; hasReplay: boolean; hasPulseWaveform: boolean;
  lastSyncedAt?: string;
}

/** User preferences, stored in the profiles table (preferences JSONB)
 *  when signed in, and kept locally otherwise. */
export interface UserPreferences {
  displayName?: string;
  cloudSave: boolean;        // save session summaries to Supabase
  savePulseWaveform: boolean; // include the pulse waveform trace (default off)
  saveReplay: boolean;       // store mesh replay in private storage (default off)
  reducedMotion: boolean;
}

/** All self-report items are optional. The scan flow, live panel and report
 *  all have access to the same answers — the scan does not invent them. */
/** Karolinska Sleepiness Scale (KSS), original 1–9 scale, kept SEPARATE from
 *  the generic 0–10 fatigue item. 1 = extremely alert, 3 = alert,
 *  5 = neither alert nor sleepy, 7 = sleepy, but no effort to keep awake,
 *  9 = extremely sleepy, fighting sleep. This is the ML primary target
 *  (desk_sleepiness task); it is never merged with RLDD classes, YawDD
 *  mouth events, CogBeacon reports, or stress/anxiety labels. */
export const KSS_LABELS: Record<number, string> = {
  1: 'Extremely alert', 2: 'Very alert', 3: 'Alert', 4: 'Rather alert',
  5: 'Neither alert nor sleepy', 6: 'Some signs of sleepiness',
  7: 'Sleepy, but no effort to keep awake',
  8: 'Sleepy, some effort to keep awake',
  9: 'Extremely sleepy, fighting sleep',
};

export interface SelfReport {
  stress?: number; fatigue?: number; energy?: number;
  eyeDiscomfort?: number; jawDiscomfort?: number;
  mood?: number; focus?: number; calm?: number;
  headache?: number; neckTension?: number;
  sleepHours?: number; screenHours?: number;
  activity?: string; note?: string; helpNow?: string[];
  /** KSS 1–9, collected BEFORE any model prediction is shown (see ScanFlow). */
  kss?: number;
}

export interface CameraMetrics {
  validSeconds: number; wallSeconds: number; framesAttempted: number;
  framesValid: number; usablePercent: number; samplingHz: number;
  interruptions: number; multipleFaceFrames: number; noFaceFrames: number;
  blinkCount: number; blinksPerMinute: number | null;
  medianBlinkDurationMs: number | null; meanBlinkIntervalSec: number | null;
  eyesClosedPercent: number; eyeClosureConsistency: number | null;
  jawOpenMean: number; jawOpenEvents: number; mouthOpenEvents: number;
  browMovement: number; lipPressMean: number; movementVariability: number;
  yawMean: number; pitchMean: number; rollMean: number;
  headVariability: number; timeOutsideForwardPercent: number;
  baselineAvailable: boolean; insufficient: boolean;
  // Expanded observational indicators (all camera-derived, see indicators.ts).
  // These are movement / appearance observations, never diagnoses.
  browRaiseMean?: number; foreheadFurrowMean?: number; eyeOpennessMean?: number;
  blinkForceMean?: number; aggressiveBlinkCount?: number; softBlinkCount?: number;
  gazeVariability?: number; jawMovementFreqPerMin?: number; jawTightnessMean?: number;
  mouthMovement?: number; tensionMovement?: number;
  eyeDarknessChange?: number; eyeRednessChange?: number; faceBrightnessChange?: number;
  fatigueIndicator?: number; energyIndicator?: number;
  // optiflow-features-v2 (see measurements.ts): unilateral/censored blink
  // measurement. Bilateral blinkCount above remains the primary count.
  leftBlinkCount?: number; rightBlinkCount?: number;
  censoredBlinkCount?: number; sustainedClosureCount?: number;
  eyeClosureFraction?: number; effectiveSamplingHz?: number;
  headYawStddevDeg?: number; headPitchStddevDeg?: number; headRollStddevDeg?: number;
  jawOpenFraction?: number; measurementVersion?: string;
}

/** Versioned ML feature record attached to a session at scan time.
 *  The label (KSS) and any model prediction are stored in separate fields
 *  and are never mixed: a prediction is never used as a label. */
export interface MLFeatureRecord {
  version: string; featureNames: string[];
  values: (number | null)[]; missing: string[]; qualityFlags: string[];
  /** Provenance for training: local collection only until a permitted
   *  external dataset adapter produces a record (none yet). */
  sourceId: string; participantId: string; recordingId: string;
  labelKss?: number | null; labelScope?: string;
  split?: 'train' | 'dev' | 'test' | 'unassigned';
  consentRecorded: boolean;
}

/** An ML model estimate, shown only when a real trained artifact exists.
 *  When no artifact exists this field is absent and the UI must say so. */
export interface MLPrediction {
  modelId: string; modelVersion: string; featureVersion: string;
  target: string; predictedKss: number; /** 1–9 scale, clipped */
  contributions: { feature: string; contribution: number }[];
  suppressedReason?: string;
  /** A user correction for later retraining — it does NOT retrain anything now. */
  userCorrectionKss?: number;
}

export interface Suggestion {
  id: string; title: string; why: string; activity: string;
  duration: string; activityId?: string; steps?: string[]; detail?: string;
}

export interface Session {
  id: string; createdAt: string; isDemo?: boolean;
  selfReport: SelfReport; camera: CameraMetrics;
  /** FINAL score = camera-derived score. Never computed from self-report. */
  score: number | null; scoreLabel: string | null; scoreColor: string | null;
  /** Camera score, explicitly, plus its components and confidence. */
  cameraScore?: number | null; cameraScoreComponents?: { name: string; weight: number; value: number; detail: string }[];
  cameraScoreConfidence?: string;
  /** Self-report score, for comparison ONLY — never the final score. */
  selfReportScore?: number | null; selfReportScoreLabel?: string | null;
  scoreContributors: string[]; suggestions: Suggestion[];
  note?: string; resetCompleted?: string[]; feedback?: Record<string, 'helpful' | 'not-for-me'>;
  scanDurationLabel: string;
  /** ML collection/inference for this session (absent for old sessions). */
  mlFeatures?: MLFeatureRecord;
  mlPrediction?: MLPrediction;
  /** Pulse Portrait for this session (absent when pulse sensing was off/unavailable). */
  pulse?: PulseResult;
  /** Mesh replay, ONLY when the user explicitly saved it with the check-in. */
  replay?: MeshReplay;
  /** Cloud metadata (set by the cloud layer at load; absent for local-only). */
  cloud?: CloudMeta;
}

/** One accepted pulse estimate + its waveform window (see rppg.ts). */
export interface PulseEstimateRecord {
  bpm: number; snr: number; windowStartSec: number; windowEndSec: number;
  validSeconds: number; coveragePct: number; latencyMs: number;
}
export interface PulseResult {
  method: string; methodVersion: string;
  /** Last accepted estimate, or null if none was accepted. */
  bpm: number | null; snr: number | null;
  estimates: PulseEstimateRecord[];
  /** Last accepted window's waveform (normalized amplitude, gaps marked). */
  waveform: { tSec: number; value: number; valid: boolean }[];
  waveformWindowStartSec: number; waveformWindowEndSec: number;
  usableSeconds: number; quality: string;
  /** Human-readable reason when no estimate was accepted. */
  unavailableReason?: string;
}

/** Bounded, timestamped replay record — in memory for the current session
 *  by default, NOT persisted unless the user explicitly saves it.
 *  Landmark-only storage is NOT anonymous: it can reconstruct face shape
 *  and movement, so it is treated as personal data. */
export interface ReplayFrame {
  tSec: number;
  /** Flat [x, y] pairs for all 468 landmarks, rounded to 4 decimals. */
  landmarks: number[];
  yaw: number; pitch: number; roll: number; valid: boolean;
}
export interface ReplayEvent {
  type: 'blink' | 'left_closure' | 'right_closure' | 'jaw_open' | 'head_turn' | 'interruption';
  tStartSec: number; tEndSec?: number; detail: string; included: boolean;
  /** How this event relates to the displayed score, in plain words. */
  scoreNote: string;
}
export interface MeshReplay {
  version: string; measurementVersion: string; pulseMethod: string;
  durationSec: number; frames: ReplayFrame[]; events: ReplayEvent[];
  createdAt: string;
}

export interface JournalEntry {
  id: string; createdAt: string; note: string;
  moodTags: string[]; energyTags: string[];
  sessionId?: string; resetId?: string;
}

export interface ResetRecord {
  id: string; createdAt: string; activityId: string; title: string;
  durationSec: number; feelBefore?: number; feelAfter?: number; favorite?: boolean;
}

export const SCORE_BANDS = [
  { min: 80, label: 'Feeling comfortable', color: '#B9CDBB' },
  { min: 60, label: 'Some discomfort', color: '#BCCFDF' },
  { min: 40, label: 'A pause may help', color: '#C9C2DD' },
  { min: 20, label: 'Consider a reset', color: '#E8DCA9' },
  { min: 0, label: 'Make room for rest', color: '#E5BAA8' },
] as const;

export interface Indicator {
  id: string; name: string; kind: 'self-report' | 'camera' | 'derived';
  display: string; comfort: number | null; color: string | null; label: string | null;
  method: string; limitation: string;
}
