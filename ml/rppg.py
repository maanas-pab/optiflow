#!/usr/bin/env python3
"""
Offline POS rPPG reference — mirrors src/lib/rppg.ts exactly in method.

Steps: resample timestamped RGB means to 30 Hz (gaps > 500 ms break the
window), detrend + z-normalise per channel, POS projection
(X = G - B, Y = -2R + G + B, pulse = X + alpha*Y, alpha = std(X)/std(Y)),
FFT band-limit to 0.7-4.0 Hz, peak BPM, SNR gate >= 2.0, motion and
illumination gates. Pure standard library (DFT, no numpy) so the
reference runs anywhere the browser code is checked.

This is NOT MTTS-CAN. MTTS-CAN (Liu et al., NeurIPS 2020, "Multi-Task
Temporal Shift Attention Networks for On-Device Contactless Vitals
Measurement", arXiv:2006.03790; code: github.com/xliucs/MTTS-CAN) is a
neural model whose published code is PyTorch, expects full-face video
clips, and has no verified browser-ready ONNX weight bundle in the
OptiFlow build. It remains a RESEARCH REFERENCE and a future evaluated
model — its paper numbers are never quoted as OptiFlow accuracy.

Evaluation harness (future, requires authorised data):
  python3 ml/rppg.py --input ubfc_samples.jsonl --report out.json
where each record carries reference BPM from a pulse oximeter and the
same RGB samples. Until such data is obtained officially (UBFC-rPPG,
COHFACE — both not_downloaded), no OptiFlow pulse accuracy is claimed.

Usage as a smoke test:
  python3 ml/rppg.py --synthetic   # 72 BPM synthetic signal, expect ~72
"""
import argparse, json, math, sys

WINDOW_SEC = 10
SAMPLE_HZ = 30
MIN_HZ, MAX_HZ, MIN_SNR = 0.7, 4.0, 2.0


def _mean(xs):
    return sum(xs) / len(xs) if xs else 0.0


def _std(xs):
    if len(xs) < 2:
        return 0.0
    m = _mean(xs)
    return math.sqrt(sum((x - m) ** 2 for x in xs) / len(xs))


def _detrend_normalise(xs):
    W = SAMPLE_HZ
    out = []
    for i, v in enumerate(xs):
        lo, hi = max(0, i - W // 2), min(len(xs), i + W // 2)
        out.append(v - _mean(xs[lo:hi]))
    m, s = _mean(out), _std(out) or 1.0
    return [(v - m) / s for v in out]


def _dft_power(signal):
    n = len(signal)
    freqs, power = [], []
    for k in range(n // 2 + 1):
        re = sum(signal[i] * math.cos(-2 * math.pi * k * i / n) for i in range(n))
        im = sum(signal[i] * math.sin(-2 * math.pi * k * i / n) for i in range(n))
        freqs.append(k * SAMPLE_HZ / n)
        power.append(re * re + im * im)
    return freqs, power


def _bandpass(signal):
    n = len(signal)
    out = [0.0] * n
    for k in range(n):
        freq = k * SAMPLE_HZ / n if k <= n // 2 else (k - n) * SAMPLE_HZ / n
        if abs(freq) < MIN_HZ or abs(freq) > MAX_HZ:
            continue
        re = sum(signal[i] * math.cos(-2 * math.pi * k * i / n) for i in range(n))
        im = sum(signal[i] * math.sin(-2 * math.pi * k * i / n) for i in range(n))
        for i in range(n):
            a = 2 * math.pi * k * i / n
            out[i] += (re * math.cos(a) - im * math.sin(a)) / n
    return out


def analyse(samples):
    """samples: list of dicts {t_ms, r, g, b, brightness, yaw_deg, valid}."""
    valid = [s for s in samples if s["valid"]]
    if len(valid) < WINDOW_SEC * 15:
        return {"accepted": False, "reason": "too little usable signal"}
    end_ms = samples[-1]["t_ms"]
    start_ms = end_ms - WINDOW_SEC * 1000
    win = [s for s in valid if s["t_ms"] >= start_ms]
    if _std([s["yaw_deg"] for s in win]) > 8:
        return {"accepted": False, "reason": "head motion too high"}
    bright = [s["brightness"] for s in win]
    jumps = [abs(bright[i] - bright[i - 1]) for i in range(1, len(bright))]
    if jumps and max(jumps) / (_mean(bright) or 1) > 0.35:
        return {"accepted": False, "reason": "lighting changed abruptly"}
    n = WINDOW_SEC * SAMPLE_HZ
    grid = []
    for i in range(n):
        t = start_ms + i / SAMPLE_HZ * 1000
        before = next((s for s in reversed(win) if s["t_ms"] <= t), None)
        after = next((s for s in win if s["t_ms"] > t), None)
        if not before or not after or after["t_ms"] - before["t_ms"] > 500:
            grid.append(None)
        else:
            f = (t - before["t_ms"]) / (after["t_ms"] - before["t_ms"] or 1)
            grid.append({k: before[k] + f * (after[k] - before[k]) for k in ("r", "g", "b")})
    if sum(1 for g in grid if g) < n * 0.7:
        return {"accepted": False, "reason": "resampled coverage below 70%"}

    def fill(vals):
        out, last = [], vals[0] if vals[0] is not None else 0.0
        for v in vals:
            if v is None:
                out.append(last)
            else:
                out.append(v); last = v
        return out

    rn = _detrend_normalise(fill([g["r"] if g else None for g in grid]))
    gn = _detrend_normalise(fill([g["g"] if g else None for g in grid]))
    bn = _detrend_normalise(fill([g["b"] if g else None for g in grid]))
    x = [gn[i] - bn[i] for i in range(n)]
    y = [-2 * rn[i] + gn[i] + bn[i] for i in range(n)]
    alpha = (_std(x) or 1) / (_std(y) or 1)
    pulse = [x[i] + alpha * y[i] for i in range(n)]
    filtered = _bandpass(pulse)
    freqs, power = _dft_power(filtered)
    band = [(f, p) for f, p in zip(freqs, power) if MIN_HZ <= f <= MAX_HZ]
    peak_f, peak_p = max(band, key=lambda fp: fp[1])
    snr = peak_p / (_mean([p for _, p in band]) or 1)
    if snr < MIN_SNR:
        return {"accepted": False, "reason": f"SNR {snr:.1f} below {MIN_SNR}", "snr": snr}
    return {"accepted": True, "bpm": round(peak_f * 60), "snr": round(snr, 1), "peak_hz": round(peak_f, 2)}


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--synthetic", action="store_true")
    args = ap.parse_args()
    if args.synthetic:
        samples = []
        for i in range(360):
            t = i / 30
            drift = math.sin(2 * math.pi * 0.1 * t) * 5
            pulse = math.sin(2 * math.pi * 1.2 * t) * 2
            samples.append({"t_ms": i * 1000 / 30, "r": 120 + drift, "g": 100 + drift + pulse,
                            "b": 90 + drift, "brightness": 103 + drift, "yaw_deg": 0, "valid": True})
        print(json.dumps(analyse(samples), indent=2))
        sys.exit(0)
    print("No authorised reference data supplied. See module docstring.", file=sys.stderr)
    sys.exit(2)
