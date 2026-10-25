import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
export const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Loads the model from a CDN on first scan. This download is disclosed in
 *  Settings & Privacy. No video leaves the device. */
export function loadLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      return FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'VIDEO', numFaces: 2,
        outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
      });
    })();
  }
  return landmarkerPromise;
}

export function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Eye Aspect Ratio from 468-point landmarks. Indices are the standard
 *  MediaPipe face-mesh eye points. */
export function earFromLandmarks(lm: { x: number; y: number }[], left: boolean): number {
  const idx = left ? { h1: 33, h2: 133, v1a: 160, v1b: 144, v2a: 158, v2b: 153 }
                   : { h1: 362, h2: 263, v1a: 385, v1b: 380, v2a: 387, v2b: 373 };
  const h = dist(lm[idx.h1], lm[idx.h2]) || 1;
  return (dist(lm[idx.v1a], lm[idx.v1b]) + dist(lm[idx.v2a], lm[idx.v2b])) / (2 * h);
}

export function blendshapeValue(categories: { categoryName: string; score: number }[] | undefined, name: string): number {
  return categories?.find(c => c.categoryName === name)?.score ?? 0;
}

/** Rotation matrix (column-major 4x4) -> yaw, pitch, roll in degrees. */
export function eulerFromMatrix(m: number[]): { yaw: number; pitch: number; roll: number } {
  // Matrix rows: r00 r01 r02 / r10 r11 r12 / r20 r21 r22 in column-major storage.
  const r00 = m[0], r01 = m[4], r02 = m[8];
  const r10 = m[1], r11 = m[5], r12 = m[9];
  const r20 = m[2], r21 = m[6], r22 = m[10];
  const pitch = Math.asin(Math.max(-1, Math.min(1, -r20))) * 180 / Math.PI;
  const yaw = Math.atan2(r10, r00) * 180 / Math.PI;
  const roll = Math.atan2(r01, r11) * 180 / Math.PI;
  void r02; void r12; void r22;
  return { yaw, pitch, roll };
}

export interface AppearanceSample { darkness: number; redness: number; brightness: number; saturation: number; }

/** Experimental relative-appearance sampler.
 *  Draws the current video frame to a small offscreen canvas and samples
 *  under-eye vs cheek pixels. Returns values relative to the frame itself;
 *  callers compare them with the session baseline (same lighting, same
 *  session) and report only the *change*. This does NOT measure dark
 *  circles, redness, puffiness, paleness, or dullness as health signs:
 *  lighting, exposure, and skin tone dominate absolute values. */
export function sampleAppearance(video: HTMLVideoElement, lm: { x: number; y: number }[], canvas: HTMLCanvasElement): AppearanceSample | null {
  try {
    const W = 256, H = 144;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const patch = (nx: number, ny: number) => {
      const cx = Math.max(2, Math.min(W - 3, Math.round(nx * W)));
      const cy = Math.max(2, Math.min(H - 3, Math.round(ny * H)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const i = ((cy + dy) * W + (cx + dx)) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      return { r: r / n, g: g / n, b: b / n };
    };
    const lum = (p: { r: number; g: number; b: number }) => 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
    const red = (p: { r: number; g: number; b: number }) => p.r - (p.g + p.b) / 2;
    const sat = (p: { r: number; g: number; b: number }) => Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
    const eyeL = { x: (lm[33].x + lm[133].x) / 2, y: (lm[33].y + lm[133].y) / 2 };
    const eyeR = { x: (lm[362].x + lm[263].x) / 2, y: (lm[362].y + lm[263].y) / 2 };
    const underL = patch(eyeL.x, eyeL.y + 0.045); const underR = patch(eyeR.x, eyeR.y + 0.045);
    const cheekL = patch(lm[205]?.x ?? 0.3, lm[205]?.y ?? 0.55); const cheekR = patch(lm[425]?.x ?? 0.7, lm[425]?.y ?? 0.55);
    const underLum = (lum(underL) + lum(underR)) / 2; const cheekLum = (lum(cheekL) + lum(cheekR)) / 2;
    const underRed = (red(underL) + red(underR)) / 2; const cheekRed = (red(cheekL) + red(cheekR)) / 2;
    return {
      darkness: cheekLum - underLum,
      redness: underRed - cheekRed,
      brightness: cheekLum,
      saturation: (sat(cheekL) + sat(cheekR)) / 2,
    };
  } catch { return null; }
}

/** Sample mean skin RGB from RAW video only (never from an overlay canvas).
 *  Patches: forehead (below landmark 10), left cheek (205), right cheek
 *  (425). Returns null when any patch is outside the frame. The caller
 *  must feed this canvas ONLY the <video> element — no mesh, halo, or
 *  other composited graphics — or the pulse signal will be contaminated
 *  by the display itself. */
export function sampleSkinRgb(video: HTMLVideoElement, lm: { x: number; y: number }[], canvas: HTMLCanvasElement): { r: number; g: number; b: number; brightness: number } | null {
  try {
    const W = 256, H = 144;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, W, H);
    const data = ctx.getImageData(0, 0, W, H).data;
    const patch = (nx: number, ny: number, half = 4) => {
      const cx = Math.round(nx * W); const cy = Math.round(ny * H);
      if (cx < half || cx >= W - half || cy < half || cy >= H - half) return null;
      let r = 0, g = 0, b = 0, n = 0;
      for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
        const i = ((cy + dy) * W + (cx + dx)) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
      }
      return { r: r / n, g: g / n, b: b / n };
    };
    const forehead = patch(lm[10]?.x ?? 0.5, (lm[10]?.y ?? 0.2) + 0.04);
    const cheekL = patch(lm[205]?.x ?? 0.3, lm[205]?.y ?? 0.55);
    const cheekR = patch(lm[425]?.x ?? 0.7, lm[425]?.y ?? 0.55);
    if (!forehead || !cheekL || !cheekR) return null;
    const r = (forehead.r + cheekL.r + cheekR.r) / 3;
    const g = (forehead.g + cheekL.g + cheekR.g) / 3;
    const b = (forehead.b + cheekL.b + cheekR.b) / 3;
    return { r, g, b, brightness: (r + g + b) / 3 };
  } catch { return null; }
}

/** Draw a delicate face mesh on a canvas overlay (landmarks only, never saved). */
export function drawMesh(ctx: CanvasRenderingContext2D, lm: { x: number; y: number }[], w: number, h: number, show: boolean) {
  ctx.clearRect(0, 0, w, h);
  if (!show) return;
  ctx.fillStyle = 'rgba(48,54,51,0.55)';
  // Draw a sparse, elegant subset: face oval + eyes + mouth outline points.
  const subset = [10, 152, 234, 454, 33, 133, 362, 263, 61, 291, 0, 17];
  for (const i of subset) {
    const p = lm[i]; if (!p) continue;
    ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = 'rgba(48,54,51,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath();
  for (const i of [10, 234, 152, 454, 10]) { const p = lm[i]; if (p) ctx.lineTo(p.x * w, p.y * h); }
  ctx.stroke();
}
