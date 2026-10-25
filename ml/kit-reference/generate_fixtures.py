"""Generate artificial feature traces for engineering tests, never health training.

Standard library only. Run from any directory. Outputs beside this script.
"""
import csv
import json
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent
BASE = [(2000, 2200), (5000, 5200), (8000, 8200)]
SCENARIOS = [
    dict(id="three_blinks", bilateral=BASE, expected=3),
    dict(id="no_blinks", bilateral=[], expected=0),
    dict(id="left_wink_only", bilateral=[], left=[(5000, 5300)], expected=0),
    dict(id="sustained_closure", bilateral=[(5000, 6500)], expected=0, sustained=1),
    dict(id="hidden_blink", bilateral=BASE, invalid=[(4800, 5600)], expected=2),
    dict(id="interrupted_closure", bilateral=[(2000, 2200), (4500, 5200), (8000, 8200)], invalid=[(4800, 5600)], expected=2),
    dict(id="irregular_sampling", bilateral=BASE, irregular=True, expected=3),
    dict(id="jaw_motion_only", bilateral=[], jaw=True, expected=0),
    dict(id="no_tracking", bilateral=[], invalid=[(0, 12000)], expected=None),
    dict(id="low_rate_2fps", bilateral=BASE, step=500, expected=None),
]


def within(t, spans):
    return any(a <= t < b for a, b in spans)


def write_csv(path, rows, fields):
    with path.open("w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def generate():
    rng = random.Random(20261024)
    all_rows, manifest = [], []
    for case in SCENARIOS:
        t, rows = 0.0, []
        while t < 12000:
            valid = not within(t, case.get("invalid", []))
            bilateral = within(t, case["bilateral"])
            left = bilateral or within(t, case.get("left", []))
            row = dict(
                scenario_id=case["id"], timestamp_ms=round(t, 3),
                is_synthetic="true", purpose="engineering_fixture",
                eligible_for_health_training="false", valid=str(valid).lower(),
                eye_open_left=round((0.08 if left else 0.90) + rng.uniform(-0.015, 0.015), 4) if valid else "",
                eye_open_right=round((0.08 if bilateral else 0.90) + rng.uniform(-0.015, 0.015), 4) if valid else "",
                jaw_open=round(0.15 + 0.12 * math.sin(t / 180), 4) if valid and case.get("jaw") else (0.02 if valid else ""),
                head_pitch_deg=round(0.8 * math.sin(t / 700), 4) if valid else "",
            )
            rows.append(row)
            t += rng.choice([25, 33, 40, 50]) if case.get("irregular") else case.get("step", 1000 / 30)
        all_rows.extend(rows)
        manifest.append(dict(
            scenario_id=case["id"], frame_rows=len(rows),
            observation_end_ms=12000,
            injected_bilateral_intervals_ms=case["bilateral"],
            injected_left_only_intervals_ms=case.get("left", []),
            invalid_intervals_ms=case.get("invalid", []),
            expected_complete_bilateral_blinks=case["expected"],
            expected_sustained_closures=case.get("sustained", 0) if case["expected"] is not None else None,
            assert_event_metrics=case["expected"] is not None,
            special_expectation=("Return unavailable event metrics; no fatigue label exists." if case["expected"] is None else "Count only complete, valid bilateral events under the fixture test policy."),
        ))
    write_csv(OUT / "synthetic_feature_traces.csv", all_rows, list(all_rows[0]))
    result = dict(
        schema_version="optiflow_fixture_v1", is_synthetic=True,
        purpose="engineering_fixture", eligible_for_health_training=False,
        contains_human_observations=False, contains_health_labels=False,
        test_policy=dict(
            bilateral_closed_below=0.25, reopened_above=0.65,
            min_blink_ms=80, max_blink_ms=500,
            max_contiguous_gap_ms=150, minimum_event_sampling_hz=10,
            boundary_rule="Require observed open state before and after a closure; invalidate interrupted events.",
            warning="These are artificial fixture conventions, not validated physiological thresholds.",
        ),
        scenarios=manifest,
    )
    (OUT / "fixture_manifest.json").write_text(json.dumps(result, indent=2) + "\n")
    return all_rows, result


def count_complete_events(rows):
    """Minimal reference checker for these fixtures, not a production detector."""
    valid_rows = [r for r in rows if r["valid"] == "true"]
    if len(valid_rows) < 2:
        return None, None
    steps = [b["timestamp_ms"] - a["timestamp_ms"] for a, b in zip(rows, rows[1:])]
    if 1000 / (sum(steps) / len(steps)) < 10:
        return None, None
    armed, start, previous = False, None, None
    blinks = sustained = 0
    for row in rows:
        t = row["timestamp_ms"]
        if row["valid"] != "true" or (previous is not None and t - previous > 150):
            armed, start = False, None
            previous = t
            continue
        previous = t
        left, right = row["eye_open_left"], row["eye_open_right"]
        if left > 0.65 and right > 0.65:
            if start is not None:
                duration = t - start
                blinks += int(80 <= duration <= 500)
                sustained += int(duration > 500)
            armed, start = True, None
        elif left < 0.25 and right < 0.25 and armed and start is None:
            start = t
    return blinks, sustained


def verify(rows, manifest):
    checks = []
    for case in manifest["scenarios"]:
        subset = [r for r in rows if r["scenario_id"] == case["scenario_id"]]
        assert all(b["timestamp_ms"] > a["timestamp_ms"] for a, b in zip(subset, subset[1:]))
        assert all(r["eye_open_left"] == "" and r["eye_open_right"] == "" for r in subset if r["valid"] == "false")
        assert all(r["is_synthetic"] == "true" and r["eligible_for_health_training"] == "false" for r in subset)
        actual = count_complete_events(subset)
        expected = (case["expected_complete_bilateral_blinks"], case["expected_sustained_closures"])
        assert actual == expected, (case["scenario_id"], actual, expected)
        checks.append(dict(scenario_id=case["scenario_id"], status="passed", actual_blinks=actual[0], actual_sustained=actual[1]))
    (OUT / "fixture_checks.json").write_text(json.dumps(dict(
        scope="Internal synthetic fixture consistency and simple reference event counting only; no human validation.",
        rows=len(rows), checks=checks,
    ), indent=2) + "\n")
    print(json.dumps({"rows": len(rows), "scenarios_passed": len(checks), "health_labels": 0}))


if __name__ == "__main__":
    verify(*generate())
