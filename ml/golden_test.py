#!/usr/bin/env python3
"""Golden parity test: Python reference inference must match the browser.

Same artifact and inputs as src/lib/modelInference.test.ts.
Run: python3 ml/golden_test.py  (exit 0 = parity held)
"""
import json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))
from train import FEATURES, predict  # noqa: E402

ARTIFACT = {
    "means": [18, 220, 0.05, 0.27, 0.1, 4, 0.12, 0.15, 3, 5, 0.02, 95],
    "scales": [6, 80, 0.05, 0.05, 0.2, 3, 0.1, 0.2, 2, 8, 0.02, 10],
    "imputes": [18, 220, 0.05, 0.27, 0.1, 4, 0.12, 0.15, 3, 5, 0.02, 95],
    "coefficients": [0.4, 0.3, 0.5, -0.4, 0.2, 0.1, 0.1, 0.3, 0.1, 0.2, 0.1, -0.1],
    "intercept": 5.0,
}
FEATURES_INPUT = {
    "blinks_per_minute": 24, "median_blink_duration_ms": 300,
    "eye_closure_fraction": 0.10, "eye_openness_mean": 0.22,
    "blink_aggressive_share": 0.125, "jaw_open_events_per_min": 6,
    "jaw_open_mean": 0.2, "tension_movement": 0.35,
    "head_yaw_stddev_deg": 5, "time_outside_forward_pct": 13,
    "gaze_variability": 0.04, "usable_percent": 90,
}
EXPECTED = 7.5

if __name__ == "__main__":
    got = round(predict(ARTIFACT["intercept"], ARTIFACT["coefficients"],
                        ARTIFACT["means"], ARTIFACT["scales"],
                        ARTIFACT["imputes"], FEATURES_INPUT), 1)
    print(f"python reference: {got}  expected: {EXPECTED}  (browser test expects 7.5)")
    sys.exit(0 if got == EXPECTED else 1)
