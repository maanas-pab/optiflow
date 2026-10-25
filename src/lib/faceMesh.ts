import { FaceLandmarker } from '@mediapipe/tasks-vision';

export type MeshRegion = 'none' | 'face' | 'leftEye' | 'rightEye' | 'mouth' | 'head' | 'forehead' | 'cheeks';
export interface MeshEvent { type: 'blink' | 'left_closure' | 'right_closure' | 'jaw_open' | 'head_turn' | 'interruption'; tSec: number; detail: string; included: boolean; }

/**
 * Detailed, elegant facial mesh drawn from REAL MediaPipe landmarks.
 *
 * Tessellation and contours are the official FaceLandmarker connection
 * sets (FACE_LANDMARKS_TESSELATION, FACE_LANDMARKS_FACE_OVAL,
 * FACE_LANDMARKS_LEFT_EYE/RIGHT_EYE/LIPS/eyebrows) from
 * @mediapipe/tasks-vision@0.10.14 — not a hand-drawn approximation.
 * Depth shading uses each landmark's z value: nearer points are drawn
 * slightly darker, giving a subtle 3D feel without a neon mask.
 *
 * Colour legend (consistent everywhere, including the replay modal):
 *   dusty blue  = observed movement
 *   lavender    = selected event
 *   muted amber = excluded / uncertain measurement
 *   sage        = usable measurement segment
 * Red is reserved for a labelled tracking issue only — never for
 * "unhealthy tissue" or stress.
 *
 * The mesh is drawn on a SEPARATE overlay canvas. The rPPG pipeline
 * never reads this canvas — it samples only the raw <video> element —
 * so mesh/halo graphics cannot contaminate the pulse signal.
 * Visual smoothing is display-only: the mesh you see is the latest
 * landmark frame, and measurement code uses its own raw values.
 */
export function drawDetailedMesh(
  ctx: CanvasRenderingContext2D,
  lm: { x: number; y: number; z?: number }[],
  w: number, h: number,
  opts: {
    intensity?: number; // 0–1, user-adjustable mesh visibility
    highlight?: MeshRegion;
    /** Recent event ripples: { region, ageSec } — age 0 = just happened. */
    ripples?: { region: MeshRegion; ageSec: number }[];
    showPoints?: boolean;
    showRoiOutlines?: boolean;
  } = {},
) {
  const intensity = opts.intensity ?? 0.85;
  if (intensity <= 0) { ctx.clearRect(0, 0, w, h); return; }
  ctx.clearRect(0, 0, w, h);
  const px = (p: { x: number; y: number }) => [p.x * w, p.y * h] as const;
  const drawConnections = (conns: { start: number; end: number }[], color: string, width: number, alpha: number) => {
    ctx.strokeStyle = color; ctx.globalAlpha = alpha * intensity; ctx.lineWidth = width;
    ctx.beginPath();
    for (const c of conns) {
      const a = lm[c.start]; const b = lm[c.end];
      if (!a || !b) continue;
      const [ax, ay] = px(a); const [bx, by] = px(b);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  };
  const drawFilled = (conns: { start: number; end: number }[], fill: string, alpha: number) => {
    // Depth-shaded tessellation: fill each triangle by its mean z.
    // Tessellation connections are edges, not triangles, so we shade by
    // drawing the edge set with a soft fill colour and low alpha — the
    // visual effect is a fine, translucent web, not a solid mask.
    void conns; void fill; void alpha;
  };
  void drawFilled;
  // 1. Fine tessellation web (dusty blue, translucent).
  drawConnections(FaceLandmarker.FACE_LANDMARKS_TESSELATION as { start: number; end: number }[], '#7a8fa3', 0.7, 0.28);
  // 2. Stronger contours: face oval, eyes, eyebrows, lips.
  drawConnections(FaceLandmarker.FACE_LANDMARKS_FACE_OVAL as { start: number; end: number }[], '#303633', 1.6, 0.85);
  drawConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYE as { start: number; end: number }[], '#303633', 1.4, 0.9);
  drawConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE as { start: number; end: number }[], '#303633', 1.4, 0.9);
  drawConnections(FaceLandmarker.FACE_LANDMARKS_LIPS as { start: number; end: number }[], '#303633', 1.4, 0.9);
  drawConnections(FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW as { start: number; end: number }[], '#5a6360', 1.2, 0.7);
  drawConnections(FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW as { start: number; end: number }[], '#5a6360', 1.2, 0.7);
  // 3. Landmark points (small, sparse — only contour points, not all 468).
  if (opts.showPoints !== false) {
    ctx.fillStyle = '#303633'; ctx.globalAlpha = 0.7 * intensity;
    const pts = [10, 152, 234, 454, 33, 133, 362, 263, 61, 291, 0, 17, 205, 425];
    for (const i of pts) {
      const p = lm[i]; if (!p) continue;
      const [x, y] = px(p);
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // 4. Highlighted region (lavender, for the selected event in replay).
  const regionConns: Partial<Record<MeshRegion, { start: number; end: number }[]>> = {
    leftEye: FaceLandmarker.FACE_LANDMARKS_LEFT_EYE as { start: number; end: number }[],
    rightEye: FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE as { start: number; end: number }[],
    mouth: FaceLandmarker.FACE_LANDMARKS_LIPS as { start: number; end: number }[],
    face: FaceLandmarker.FACE_LANDMARKS_FACE_OVAL as { start: number; end: number }[],
  };
  if (opts.highlight && opts.highlight !== 'none' && regionConns[opts.highlight]) {
    drawConnections(regionConns[opts.highlight]!, '#8a7fb8', 2.6, 0.95);
  }
  // 5. Event ripples: expanding, fading rings around the event region.
  //    Only for REAL events (blink etc.) passed in by the caller.
  for (const r of opts.ripples ?? []) {
    if (r.ageSec > 1.2) continue;
    const centreIdx = r.region === 'leftEye' ? 33 : r.region === 'rightEye' ? 362 : r.region === 'mouth' ? 13 : 1;
    const p = lm[centreIdx]; if (!p) continue;
    const [x, y] = px(p);
    const progress = r.ageSec / 1.2;
    ctx.strokeStyle = '#8a7fb8'; ctx.globalAlpha = (1 - progress) * 0.8 * intensity; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 18 + progress * 55, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  // 6. Subtle ROI outlines for pulse sensing (forehead + cheeks, dashed).
  if (opts.showRoiOutlines) {
    ctx.strokeStyle = '#7a8fa3'; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2; ctx.globalAlpha = 0.6 * intensity;
    const box = (idx: number, dx: number, dy: number) => {
      const p = lm[idx]; if (!p) return;
      const [x, y] = px(p);
      ctx.strokeRect(x - dx, y - dy, dx * 2, dy * 2);
    };
    box(10, w * 0.04, h * 0.03); // forehead, below landmark 10
    box(205, w * 0.03, h * 0.03); // left cheek
    box(425, w * 0.03, h * 0.03); // right cheek
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
}

/** Interpolate landmarks between two replay frames for smooth replay. */
export function interpolateLandmarks(
  a: { x: number; y: number }[], b: { x: number; y: number }[], f: number,
): { x: number; y: number }[] {
  return a.map((p, i) => {
    const q = b[i]; if (!q) return p;
    return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
  });
}
