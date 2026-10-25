#!/usr/bin/env python3
"""
OptiFlow offline training + evaluation for the desk_sleepiness task.

Target: current self-reported sleepiness on the Karolinska Sleepiness
Scale (KSS), original 1-9 scale. NOT the 0-10 generic fatigue item, NOT
RLDD classes, NOT YawDD mouth events, NOT CogBeacon reports, NOT anxiety.

Input: a JSONL file of records matching ml/schema.json. Each record:
  source_id, participant_id, recording_id, session_id, created_at,
  label_kss (1-9 or null), features (dict of the 12 FEATURE_NAMES),
  quality_flags, consent_recorded, provenance.

  Real records come from:
    (a) local collection exported from the app (Settings -> Export),
        where KSS was collected BEFORE any prediction was shown, or
    (b) a dataset adapter (ml/adapters.py) after permitted access.
  Synthetic kit fixtures are REJECTED here (see _reject_synthetic):
  they are engineering checks for the measurement code, never training
  or evaluation data. If a record's source_id is 'synthetic' or its
  provenance mentions the kit fixtures, training aborts.

Splits: grouped by participant_id (and recording_id). --test-participants
names held-out participants; otherwise the last 20% of participants
(sorted, deterministic) are held out. Overlapping windows / augmented
copies share a participant, so they stay in the same split by construction.
Preprocessing (means, scales, imputation medians) is fitted on TRAIN
only, then applied to dev/test. No test data is used for fitting or
hyperparameter choice; --alpha is chosen on dev (train participants
split again, grouped) or fixed by the caller.

Models, in order:
  1. constant baseline (train mean KSS)
  2. ridge regression (standardised features, closed-form, stdlib only)
  3. (future, only if justified) small nonlinear model — not implemented
     until a real comparison shows the ridge baseline is insufficient.

Output: a model artifact JSON (ml/model_schema.json) + evaluation
report JSON. The artifact's browser implementation is in
src/lib/modelInference.ts; golden parity is checked by ml/golden_test.py
and src/lib/modelInference.test.ts on identical inputs.

Usage:
  python3 ml/train.py --input data/kss_records.jsonl \
      --out ml/artifacts/optiflow-kss-ridge-v1.json \
      --report ml/artifacts/optiflow-kss-ridge-v1.eval.json
  python3 ml/train.py --demo   # runs the pipeline on a tiny, clearly
      # labelled SYNTHETIC smoke-test set to prove the code runs;
      # the output is marked demo_only=true and must NEVER be shipped
      # as a trained model (it contains no human data at all).

Requires: Python 3.10+ standard library only (no sklearn needed).
"""
from __future__ import annotations

import argparse, hashlib, json, math, sys
from pathlib import Path

FEATURES = json.loads((Path(__file__).parent / "schema.json").read_text())["feature_names"]
SCHEMA_VERSION = 1


def _reject_synthetic(records):
    for r in records:
        src = str(r.get("source_id", "")).lower()
        prov = str(r.get("provenance", "")).lower()
        if "synthetic" in src or "fixture" in prov or "synthetic" in prov:
            raise SystemExit(
                "REFUSED: synthetic kit fixtures cannot train or evaluate a "
                "human-state model. Record %s was rejected." % r.get("session_id")
            )


def load_records(path: Path, demo: bool = False):
    if demo:
        # Smoke-test only: deterministic toy rows, explicitly NOT human data.
        # Used to prove train/eval/export code runs end-to-end.
        return [
            {"source_id": "demo_smoke_test", "participant_id": f"demo-p{i%4}",
             "recording_id": f"demo-r{i}", "session_id": f"demo-s{i}",
             "created_at": "2026-10-24T00:00:00Z", "label_kss": 3 + (i % 5),
             "features": {f: 18 + i * 0.5 if f == "blinks_per_minute" else 0.05
                          for f in FEATURES},
             "quality_flags": [], "consent_recorded": False,
             "provenance": "demo_smoke_test_not_human_data"}
            for i in range(40)
        ]
    records = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    _reject_synthetic(records)
    return records


def usable(r):
    if r.get("label_kss") is None:
        return False
    if not (1 <= r["label_kss"] <= 9):
        return False
    if "valid_seconds_below_10" in r.get("quality_flags", []):
        return False
    if "usable_percent_below_30" in r.get("quality_flags", []):
        return False
    return True


def grouped_split(records, test_participants=None, test_fraction=0.2):
    parts = sorted({r["participant_id"] for r in records})
    if test_participants:
        test = set(test_participants)
    else:
        n_test = max(1, int(len(parts) * test_fraction)) if len(parts) >= 3 else 0
        test = set(parts[-n_test:]) if n_test else set()
    train = [r for r in records if r["participant_id"] not in test]
    test_r = [r for r in records if r["participant_id"] in test]
    return train, test_r


def fit_preprocess(train):
    means, scales, imputes = [], [], []
    for f in FEATURES:
        vals = [r["features"][f] for r in train if r["features"].get(f) is not None]
        if not vals:
            means.append(0.0); scales.append(1.0); imputes.append(None)
            continue
        m = sum(vals) / len(vals)
        var = sum((v - m) ** 2 for v in vals) / len(vals)
        s = math.sqrt(var) or 1.0
        vals_sorted = sorted(vals)
        med = vals_sorted[len(vals_sorted) // 2]
        means.append(m); scales.append(s); imputes.append(med)
    return means, scales, imputes


def design(records, means, scales, imputes):
    rows, ys = [], []
    for r in records:
        row = []
        for i, f in enumerate(FEATURES):
            v = r["features"].get(f)
            if v is None:
                v = imputes[i] if imputes[i] is not None else means[i]
            row.append((v - means[i]) / scales[i])
        rows.append(row); ys.append(r["label_kss"])
    return rows, ys


def solve(A, b):
    """Gaussian elimination with partial pivoting (small matrices only)."""
    n = len(b)
    M = [row[:] + [b[i]] for i, row in enumerate(A)]
    for col in range(n):
        piv = max(range(col, n), key=lambda r: abs(M[r][col]))
        if abs(M[piv][col]) < 1e-12:
            continue
        M[col], M[piv] = M[piv], M[col]
        for r in range(n):
            if r != col and M[r][col] != 0:
                factor = M[r][col] / M[col][col]
                for c in range(col, n + 1):
                    M[r][c] -= factor * M[col][c]
    return [M[i][n] / M[i][i] if abs(M[i][i]) > 1e-12 else 0.0 for i in range(n)]


def fit_ridge(rows, ys, alpha=1.0):
    d = len(FEATURES)
    # Normal equations with ridge penalty (intercept unpenalised).
    A = [[0.0] * (d + 1) for _ in range(d + 1)]
    b = [0.0] * (d + 1)
    for row, y in zip(rows, ys):
        x = [1.0] + row
        for i in range(d + 1):
            b[i] += x[i] * y
            for j in range(d + 1):
                A[i][j] += x[i] * x[j]
    for i in range(1, d + 1):
        A[i][i] += alpha
    sol = solve(A, b)
    return sol[0], sol[1:]


def predict(intercept, coefs, means, scales, imputes, features):
    z = intercept
    for i, f in enumerate(FEATURES):
        v = features.get(f)
        if v is None:
            v = imputes[i] if imputes[i] is not None else means[i]
        z += coefs[i] * ((v - means[i]) / scales[i])
    return max(1.0, min(9.0, z))


def mae(preds, ys):
    return sum(abs(p - y) for p, y in zip(preds, ys)) / len(ys) if ys else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", type=Path)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--report", type=Path, required=True)
    ap.add_argument("--alpha", type=float, default=1.0)
    ap.add_argument("--test-participants", nargs="*", default=None)
    ap.add_argument("--demo", action="store_true")
    args = ap.parse_args()
    records = load_records(args.input, demo=args.demo) if not args.demo else load_records(None, demo=True)
    kept = [r for r in records if usable(r)]
    excluded = len(records) - len(kept)
    train, test = grouped_split(kept, args.test_participants)
    if len(train) < 10:
        print(f"Not enough usable training records: {len(train)} train, "
              f"{len(test)} test, {excluded} excluded. Collect more labelled "
              "sessions (KSS) before training; no model is exported.", file=sys.stderr)
        return 2
    means, scales, imputes = fit_preprocess(train)
    Xtr, ytr = design(train, means, scales, imputes)
    intercept, coefs = fit_ridge(Xtr, ytr, args.alpha)
    const = sum(ytr) / len(ytr)
    report = {
        "task": "desk_sleepiness", "target": "KSS 1-9",
        "participants_total": len({r["participant_id"] for r in kept}),
        "records_total": len(records), "records_usable": len(kept),
        "records_excluded": excluded, "train_records": len(train),
        "test_records": len(test),
        "train_participants": len({r["participant_id"] for r in train}),
        "test_participants": sorted({r["participant_id"] for r in test}),
        "label_distribution_train": {str(k): sum(1 for y in ytr if y == k) for k in range(1, 10)},
        "baseline_constant_mae_train": mae([const] * len(ytr), ytr),
        "ridge_mae_train": mae([predict(intercept, coefs, means, scales, imputes, r["features"]) for r in train], ytr),
        "split": "participant_and_recording_grouped",
        "feature_version": "optiflow-features-v2",
        "demo_only": args.demo,
    }
    if test:
        Xte, yte = design(test, means, scales, imputes)
        report["baseline_constant_mae_test"] = mae([const] * len(yte), yte)
        report["ridge_mae_test"] = mae([predict(intercept, coefs, means, scales, imputes, r["features"]) for r in test], yte)
        report["test_coverage_pct"] = round(len(test) / len(kept) * 100, 1)
    else:
        report["note"] = "No held-out participants available; test metrics are absent. Do not report this model as validated."
    artifact = {
        "model_id": "optiflow-kss-ridge", "model_version": "1.0.0",
        "feature_version": "optiflow-features-v2", "feature_names": FEATURES,
        "means": means, "scales": scales, "impute_values": imputes,
        "coefficients": coefs, "intercept": intercept, "target": "kss_1_9",
        "evaluation": report, "demo_only": args.demo,
        "limitations": [
            "Trained only on the records in the input file; see evaluation report for participant counts.",
            "KSS is self-reported sleepiness, not a clinical or physiological measurement.",
            "Do not use for driving, medical, or safety decisions.",
        ],
    }
    blob = json.dumps(artifact, sort_keys=True).encode()
    artifact["checksum"] = "sha256:" + hashlib.sha256(blob).hexdigest()
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(artifact, indent=2))
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    if args.demo:
        print("WARNING: demo_only artifact — smoke-test code path only, "
              "contains no human data, must NOT be shipped as a trained model.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
