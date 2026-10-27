# OptiFlow ML — what actually exists, and what does not

## Honest status (2026-10-24)

- **Trained models on human data: 0.** No external dataset has been
  downloaded (UTA-RLDD, CogBeacon, YawDD, UBFC-rPPG, COHFACE, UBFC-Phys
  are all `not_downloaded`, research references only).
- **No ML sleepiness estimate is shown in the app.** The report says
  "Model evaluation pending" and shows no estimate, because no trained
  artifact exists. The 0–100 camera check-in score is a separate,
  transparent composite — never presented as ML.
- **What IS built and tested:** measurement code (v2), a KSS collection
  flow, a versioned feature schema, dataset adapters (with explicit
  refusal to guess formats), a stdlib-only training/evaluation pipeline,
  a browser inference interface with suppression rules, and golden
  parity between Python and browser inference (both give 7.5).

## Primary task

Predict current self-reported sleepiness on the Karolinska Sleepiness
Scale (KSS), original 1–9 scale, from `optiflow-features-v2` camera
features. KSS is collected in the app BEFORE any prediction is shown.
It is never merged with RLDD classes, YawDD mouth events, CogBeacon
cumulative reports, or anxiety/task labels.

## How we should actually train

1. Collect sessions in the app, answering the KSS question each time.
   Export from Settings, then convert:
   ```
   python3 ml/export_to_jsonl.py export.json data/kss_records.jsonl
   ```
   Or obtain an external dataset officially and implement its adapter
   in `ml/adapters.py` after inspecting a real archive.
2. Train and evaluate (participant-grouped split, constant baseline
   first, then ridge regression):
   ```
   python3 ml/train.py --input data/kss_records.jsonl \
     --out ml/artifacts/optiflow-kss-ridge-v1.json \
     --report ml/artifacts/optiflow-kss-ridge-v1.eval.json
   ```
3. Only ship the artifact if the held-out report is acceptable, and
   only then load it in the app (see `src/lib/modelInference.ts`).
   The app suppresses predictions when the artifact is absent, the
   feature version mismatches, quality gates fail, or a feature is
   missing without an imputation value.

## Smoke tests

- `python3 ml/train.py --demo ...` proves the pipeline runs end-to-end.
  Output is marked `demo_only=true` and contains no human data.
- `python3 ml/golden_test.py` — Python reference gives 7.5, matching
  `src/lib/modelInference.test.ts`.
- Kit synthetic fixtures (`data/synthetic_feature_traces.csv`) are
  engineering checks for measurement code only. `train.py` REFUSES any
  record whose source/provenance mentions synthetic fixtures.
