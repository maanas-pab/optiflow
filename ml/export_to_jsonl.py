#!/usr/bin/env python3
"""Convert an OptiFlow app export (Settings -> Export JSON) into training
JSONL records matching ml/schema.json, for the desk_sleepiness task only.

Only sessions with a KSS label AND an mlFeatures record are emitted.
Sessions without KSS are skipped (not labelled by guessing). Synthetic
demo sessions are skipped. Predictions, if any, are never used as labels.

Usage: python3 ml/export_to_jsonl.py export.json out.jsonl
"""
import json, sys

if __name__ == "__main__":
    src, dst = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    out = []
    for s in data.get("sessions", []):
        if s.get("isDemo"):
            continue
        ml = s.get("mlFeatures")
        kss = s.get("selfReport", {}).get("kss")
        if not ml or kss is None:
            continue
        feats = dict(zip(ml["featureNames"], ml["values"]))
        out.append({
            "source_id": "local-collection",
            "participant_id": "local-user",
            "recording_id": s["id"],
            "session_id": s["id"],
            "created_at": s["createdAt"],
            "label_kss": kss,
            "label_scope": "KSS 1-9, current sleepiness, collected before any model prediction",
            "features": feats,
            "feature_version": ml["version"],
            "quality_flags": ml.get("qualityFlags", []),
            "missing_features": ml.get("missing", []),
            "provenance": "optiflow_local_collection",
            "consent_recorded": True,
        })
    with open(dst, "w") as f:
        for r in out:
            f.write(json.dumps(r) + "\n")
    print(f"Wrote {len(out)} labelled records to {dst} "
          f"(skipped {len(data.get('sessions', [])) - len(out)} unlabelled/demo sessions).")
