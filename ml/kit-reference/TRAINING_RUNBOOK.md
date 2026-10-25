# How this folder becomes a trained OptiFlow model

This runbook specifies work for the coder. It is not a claim that those jobs have run.

## 1. Keep independent model tasks

| Task | Evidence/data | Input | Output | Evaluation |
|---|---|---|---|---|
| Blink measurement | Authorized manually annotated video; synthetic fixtures only for code checks | Eye feature sequence and validity mask | Event intervals | Event precision/recall and timing error |
| Public drowsiness benchmark | UTA-RLDD | Temporal eye/movement features | Original three vigilance classes | Participant-held-out macro-F1, balanced accuracy, class recall |
| Desk sleepiness prediction | Newly collected consented local KSS sessions | Camera features; optional separately tested context/task inputs | Current subjective KSS, 1–9 | Unseen-person MAE, coverage, per-person errors; later-session evaluation separately |
| Mouth-event recognition | YawDD | Mouth-region or geometric sequence | Yawning versus documented alternatives | Original-person-held-out event/class metrics |
| Pulse estimation | Authorized UBFC-rPPG; COHFACE external test | Timestamped RGB skin-region signals/video | Pulse waveform and rate estimate | Reference-aligned rate MAE, bias, coverage, robustness |
| Cognitive-fatigue study | CogBeacon | Compatible low-rate facial/task features | Precisely reconstructed original event target | Person-grouped results; no invented KSS mapping |
| Exploratory stress-context study | UBFC-Phys | Available deployment-compatible inputs | A precisely declared original endpoint | Task-confound tests and person-held-out evaluation |

Do not turn the last row into a consumer stress detector merely because the dataset contains stress-related tasks. Never fuse the different labels into a common “health” target.

## 2. Acquire and inspect

Read `source_catalog/acquisition_manifest.csv`. Obtain each chosen dataset through its official access process. Do not bypass logins, approvals, or licenses. Record accepted terms, permitted uses, local paths, checksum, and dataset version in a private acquisition manifest.

Do not publish local raw-data paths, identities, access credentials, or signed agreements in the public source tab. The public tab needs source and usage status only.

Start with a small authorized sample to inspect actual formats. Validate that annotations, participant identifiers, timestamps, and modalities match their documentation before processing the full archive.

## 3. Implement explicit adapters

Each adapter must emit: source ID, original participant ID, original recording ID, timestamps, original labels, label scope, quality mask, extractor version, and split assignment.

- RLDD: retain categorical codes; retain source participant folds.
- CogBeacon: preserve 2-FPS sampling and original cumulative report semantics. Distinguish an increment from a running total. Do not call upsampled points new observations.
- YawDD: inspect whether labels describe clips or event intervals; annotate only under the permitted protocol when interval labels are missing.
- UBFC-rPPG/COHFACE: align reference and video using their actual timing. Verify the reference channel used.
- UBFC-Phys: keep task labels separate from anxiety responses and wrist signals. Evaluate speaking/task shortcuts.

## 4. Build splits before features or augmentation

Group every derived window and augmented copy with its source participant/recording. Define untouched test participants, development folds, and any separate calibration set. For personalization, define a different chronological protocol that predicts later sessions using earlier information only.

Record the exact split manifests. Do not cherry-pick participants or re-tune based on final test results. Bootstrap or report variation at the participant level where appropriate; thousands of windows are not thousands of independent people.

## 5. Fit a baseline, then compare complexity

For a local KSS pilot, use a simple constant baseline and a regularized regression/ordinal approach with preprocessing fitted inside each training fold. Define an explicit feature allowlist. Prohibit identifiers, current self-report answers, future information, synthetic health labels, and baselines computed across test/future observations.

Add a small nonlinear or temporal model only after measuring the baseline. Compare each candidate using the same endpoint and split. Report sample counts, exclusions, rejection coverage, and failure modes along with average error.

For pulse, compare a signal-processing baseline such as POS with any permitted pretrained/neural approach. Pulse training requires video/color information and synchronized physiological reference; facial landmark coordinates alone are not a substitute.

## 6. Export a reproducible artifact

Produce a model file plus manifest containing:
- Target definition, source label scale, model and feature versions.
- Feature order, units, scaling, imputation, and validity rules.
- Training data IDs/versions, split IDs, and permissible-use provenance.
- Evaluation report location, tested conditions, and known failures.
- Model checksum and training code commit.

Validate Python/browser outputs on golden test cases, including missingness and boundary conditions. For pulse, test preprocessing and signal extraction parity as well as inference.

## 7. Make the UI reflect evidence

Change `research_reference` to `integrated` only when a dependency is actually used and pinned. Mark a dataset `trained_on` only after a run manifest records that use. Mark it `validated_on` only with an evaluation report. Keep separate training and evaluation roles; a training result is not held-out validation.

The current synthetic fixtures are always engineering fixtures. Never badge them as human-model validation.

## 8. LLM explanations

If adding a product LLM, supply structured measurements, valid model outputs, and approved research notes. Ask it to explain rather than estimate missing physiology. It must not generate new scores, convert pulse to stress, fabricate citations, or diagnose from face images.

A retrieval-based reference library can improve source-grounded explanations. It is separate from training the camera predictor and separate from fine-tuning the coding LLM.

## Completion evidence to ask the coder for

Working capture/demo; dataset manifest; event measurement checks; grouped test report; model card; export parity tests; observed runtime performance; explicit unsupported claims; and accurate public source/status records.
