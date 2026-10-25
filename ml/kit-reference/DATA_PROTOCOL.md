# Data collection, labeling, and training contract

## 1. Define the endpoint before collecting data

Recommended primary research target: **self-reported current sleepiness**, preserving the chosen instrument's scale and protocol. KSS uses a 1–9 scale; consult the instrument and [validation publication](https://pubmed.ncbi.nlm.nih.gov/16679057/) for implementation. Do not recreate its wording from memory.

Keep additional fields separate: generic fatigue 0–10, perceived stress 0–10, eye discomfort 0–10, jaw discomfort 0–10, and task workload under a specified instrument. Do not convert missing answers to zero. Do not predict one endpoint and label the output as another.

The previously proposed 0–100 check-in score can remain an explicitly nonclinical summary of voluntary responses. Keep it separate from prediction labels and objective measurements. No camera-derived “overall health” ground truth exists in this pack.

## 2. Collection proposal

Suggested pilot scope, not a statistical sample-size justification: 20–40 consenting adults, with repeated sessions over several days. Use the pilot to estimate noise, feasibility, missingness, and model error; expand based on learning curves and the desired evaluation precision.

Do not induce sleep deprivation, distress, or medical symptoms. Collect naturally varying ordinary desk sessions. For institutional research, follow the applicable consent and ethics process.

Each session:

1. Obtain explicit consent for collection/export. Separate normal app use from contributing research data.
2. Record a pseudonymous participant ID, session ID, local context, device/browser, effective FPS, and extraction version.
3. Run a distinct setup step. Ask the user to sit comfortably; do not demand a smile or other target expression.
4. Collect about 60 seconds of time-stamped natural observations. This duration is a design starting point, not proven sufficient for reliable sleepiness prediction.
5. Immediately collect the current sleepiness response and record response time. Do not show the model prediction until after the label, to reduce anchoring. Store the prediction before the label arrives.
6. If using a reaction task, record its start/end, protocol, trials, and a separate temporally appropriate label. Do not casually merge pre-task and post-task states.
7. Offer a voluntary reset. Capture helpfulness and any follow-up response with elapsed time. Never force repeat scanning to raise a score.

Keep context categories consistent: quiet scan, reading, task, conversation, other. Ask about sleep or recent screen time only as voluntary context. Evaluate context-only models so the camera's incremental contribution is visible.

## 3. Three storage levels

### A. Temporary frame-level signals

Use a bounded in-memory buffer by default. Proposed fields:

| Field | Type/unit | Rule |
|---|---|---|
| timestamp_ms | Monotonic milliseconds within session | Strictly increasing for processed frames |
| valid | Boolean | False on missing/occluded/unusable observations |
| face_count | Integer or null | Only record a known count; do not infer it from a one-face limit |
| eye_open_left/right | Normalized proxy | Calibration-relative openness, not anatomical percentage |
| jaw_open | Model coefficient | Not measured muscle tension |
| head_pitch/yaw/roll | Degrees, specified convention | Relative to reference, with versioned method |
| light_proxy | Unitless image statistic | Never label as lux |
| gap_ms | Milliseconds | Time since preceding processed frame |

If invalid, measurement fields are null, not zeros. Do not save raw video by default. Retaining frame-level signals still requires a retention policy: derived biometric/behavioral data is not automatically anonymous.

### B. Session/window features

Use the CSV templates as starting contracts. Make window duration and timestamp boundaries explicit. Suggested features:

- Usable seconds, coverage, effective FPS, longest gap.
- Bilateral blink count, valid-time-normalized rate, censored-event count.
- Median blink duration only when enough complete sampled events exist.
- Median and spread of interblink intervals, with missingness when insufficient events exist.
- Eye-closed fraction with threshold/definition version.
- Head-angle variability with rotation convention.
- Jaw-opening activity with definition version.
- Optional relative differences from previous comparable sessions, using only past information.

A short scan with no detected blink does not establish abnormality. A tiny event sample may yield no duration estimate. Quality policies should be configurable and validated; do not disguise provisional engineering thresholds as biological standards.

### C. Labels and provenance

Keep a separate labels table joined by session ID. It includes label name, value, source, timestamp, instrument version, and whether it is a genuine self-report.

For a public dataset retain the original participant/video/session IDs, source label, label scope, label mapping, acquisition modality, license/access record, and checksum. A coarse clip label is weak supervision for shorter windows, not a fresh label on each frame.

## 4. Empty CSV templates

`templates/sessions.csv`: session identity, data provenance, consent/export status, timestamps, feature summaries, and context.

`templates/labels.csv`: one row per label event; missing labels remain absent.

`templates/reaction_trials.csv`: stimulus and response times, validity, device context, and protocol.

`templates/interventions.csv`: activity, pre/post sessions, optional helpfulness, and assignment method.

These contain headers only. No participant observations have been collected by this research task.

## 5. Synthetic data: exactly what has been created

The included trace fixture has known artificial eye-closure pulses, missing-tracking intervals, unilateral closures, jaw movement, variable sampling, and sustained closures. It represents simplified feature-level signals, not rendered human video or actual MediaPipe output.

Its labels describe **injected engineering events**. It contains no fatigue, stress, mental-health, or pulse ground truth. It can test:

- Counting complete bilateral blink events.
- Not counting unilateral events as bilateral blinks.
- Distinguishing a sustained closure from a short blink under a declared test policy.
- Handling irregular timestamps and censoring interrupted events.
- Keeping missing values out of statistical denominators.
- Refusing estimates when there is no usable tracking.

Synthetic fixture rows carry `is_synthetic=true`, `purpose=engineering_fixture`, and `eligible_for_health_training=false`. A real training pipeline must reject them. Passing these fixtures only demonstrates basic signal-processing behavior; real-video annotation is still required.

Do not create a “fatigue label” with a formula such as `10 × eye_closed_fraction` and train a model to predict it. That teaches a made-up rule, not a discovered human relationship. Synthetic regression tests can verify export parity, but should never enter real performance reports.

## 6. Turning authorized public data into features

1. Read access terms and preserve the original label definitions.
2. Construct a manifest of participant, session, original clip, path, split, and checksum.
3. Assign participant splits before extraction, augmentation, or windowing.
4. Decode using actual timestamps. Run the same landmark model and measurement definitions as the browser.
5. Store feature sequences, quality masks, original source label, and label scope.
6. Use declared windows; never allow overlapping windows or augmented copies across splits.
7. Inspect measurement failures manually on an authorized sample.
8. Train a source-specific baseline and evaluate it with its original target.
9. Test transfer on independently collected desk sessions under the target endpoint. Any label mapping must be justified, not guessed.

For CogBeacon, consume the provided low-rate landmark features only for compatible slow behaviors. Do not upsample them and claim recovered blinks. For DROZY, preserve missing tests, timestamps, and its different imaging modality. For pulse data, align reference and video with the documented synchronization, not arbitrary row matching.

## 7. Training and evaluation recipe

Before training, reject any record that is synthetic, lacks an appropriate genuine label, has an unknown feature version, or has no permissible-use/collection provenance. Apply a preregistered quality policy and log exclusions.

Example conceptual flow:

```python
assert not rows.is_synthetic.any()
assert rows.label_source.eq("self_report").all()  # for local KSS task
assert rows.label_name.eq("kss").all()
assert rows.label_value.between(1, 9).all()

# Explicit allowlist: never include labels, IDs, future outcomes, or whole-dataset baselines.
X = rows[FEATURE_ALLOWLIST]
y = rows.label_value
groups = rows.participant_id

# Fit every preprocessing step only within each training fold.
# Tune using grouped development folds; assess once on untouched participants.
```

The code above is a specification sketch, not a runnable training implementation.

Report:
- Original participants, sessions, and windows separately.
- Label distribution and missing/excluded data.
- KSS MAE in scale points; per-person errors and an ordinal-aware supplementary metric if used.
- For RLDD: class-wise recall, confusion matrix, balanced accuracy, macro-F1.
- For blink measurement: event precision/recall and timing error against annotation.
- For pulse: rate error against synchronized reference, bias, rejection coverage, and condition-specific results.
- Accepted versus rejected-session proportions.
- Baselines and input-channel ablations.
- Device/lighting/occlusion slices; optional consented demographic audit with adequate sample counts.

Keep preprocessing, calibration, uncertainty fitting, and feature selection outside the untouched test set. A same-person future-session experiment has a different claim from a new-person experiment.

## 8. LLM role

Use the coding LLM to implement extraction, inspect label documentation, create tests, and write reproducible experiments. An optional product LLM may explain structured results with approved source-backed text.

Do not use an LLM to manufacture true fatigue labels, invent missing camera readings, diagnose from selfies, or claim accuracy without a test report. Reading papers improves the assistant's implementation context; model accuracy improves only when measurement, training evidence, and evaluation support it.
