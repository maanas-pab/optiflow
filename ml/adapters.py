#!/usr/bin/env python3
"""
Dataset adapters — explicit, per-dataset, and honest about access.

Each adapter's job is ONLY to translate a permitted, inspected archive
into records matching ml/schema.json, preserving:
  source_id, participant_id, recording_id, timestamps, original label,
  label scope, feature-extractor version, quality/missingness, provenance,
  and split assignment (grouped by participant/recording, assigned here
  before any windowing).

STATUS TODAY (2026-10-24): every external dataset is NOT_DOWNLOADED.
No adapter below has run on a real archive, because no archive has been
obtained through its official access route. The functions are therefore
stubs that (a) document the required official access, (b) validate that
an inspected archive matches its documented format, and (c) refuse to
guess formats, annotation granularity, or label mappings.

Do NOT:
- bypass logins, approvals, or licences;
- infer a dataset's annotation scope from a paper abstract;
- map RLDD alert/low-vigilant/drowsy (0/5/10 encodings) to KSS numbers;
- map CogBeacon cumulative button presses to KSS;
- map YawDD mouth conditions to sleepiness;
- map UBFC-Phys anxiety scores or task labels to stress;
- treat a downloaded dataset as "trained on" — training is a separate
  run recorded in a training manifest (see TRAINING_RUNBOOK.md).

To use an adapter: obtain the dataset officially, inspect a small sample,
fill in the adapter's format checks, and only then run it. Record the
accepted terms, local path (private manifest only, never in the public
tab), checksum, and dataset version.
"""
from __future__ import annotations

DATASETS = {
    "uta-rldd": {
        "official_url": "https://sites.google.com/view/utarldd/home",
        "paper": "https://arxiv.org/abs/1904.07312",
        "access": "Author page links to a Google Drive archive (~111 GB). Preserve participant folds.",
        "labels": "Participant-reported alert / low-vigilant / drowsy clip classes; numeric codes 0, 5, 10 are category encodings, NOT a scale.",
        "role": "Separate temporal drowsiness benchmark (macro-F1, participant-held-out).",
        "status": "not_downloaded",
    },
    "cogbeacon": {
        "official_url": "https://github.com/MikeMpapa/CogBeacon-MultiModal_Dataset_for_Cognitive_Fatigue",
        "paper": "https://doi.org/10.3390/technologies7020046",
        "access": "Repository describes data folders and linked downloads; inspect completeness before use.",
        "labels": "Cumulative participant button presses indicating difficulty keeping up, plus task outcomes. NOT KSS. Distinguish an increment from a running total.",
        "role": "Collection-method reference; low-frequency (2 FPS) facial/task research only.",
        "status": "not_downloaded",
    },
    "yawdd": {
        "official_url": "https://doi.org/10.21227/e1qm-hb90",
        "paper": "https://doi.org/10.1145/2557642.2563678",
        "access": "IEEE DataPort listing requires login for dataset files.",
        "labels": "Mouth/activity conditions; inspect whether labels describe clips or event intervals before any event metric.",
        "role": "Mouth-event recognition with documented alternatives as hard negatives.",
        "status": "not_downloaded",
    },
    "ubfc-rppg": {
        "official_url": "https://sites.google.com/view/ybenezeth/ubfcrppg",
        "paper": "https://doi.org/10.1016/j.patrec.2017.10.017",
        "access": "Author page links to data and reference-reading code.",
        "labels": "Reference PPG waveform and pulse rate. No fatigue/stress ground truth.",
        "role": "FUTURE PHASE ONLY — pulse estimation benchmark. Out of scope for this phase.",
        "status": "not_downloaded",
    },
    "cohface": {
        "official_url": "https://www.idiap.ch/en/scientific-research/data/cohface",
        "paper": "https://publications.idiap.ch/attachments/papers/2017/Heusch_ARXIV_2017.pdf",
        "access": "Zenodo record is public but files are restricted; request access officially.",
        "labels": "Synchronized blood volume pulse and respiration references.",
        "role": "FUTURE PHASE ONLY — external pulse-estimation test. Out of scope for this phase.",
        "status": "not_downloaded",
    },
    "ubfc-phys": {
        "official_url": "https://sites.google.com/view/ybenezeth/ubfc-phys",
        "paper": "https://doi.org/10.1109/TAFFC.2021.3056960",
        "access": "Author page links to IEEE DataPort and dat@UBFC.",
        "labels": "Task conditions, physiological recordings, pre/post self-reported anxiety. Anxiety is NOT a per-frame label; task identity may be a shortcut.",
        "role": "Later multimodal / task-confound research only. Never a consumer stress detector.",
        "status": "not_downloaded",
    },
    "local-collection": {
        "official_url": None,
        "access": "In-app collection with consent (see ScanFlow KSS question, collected before any prediction).",
        "labels": "KSS 1-9, current sleepiness, original scale.",
        "role": "PRIMARY TASK (desk_sleepiness) — the only label source wired into the app today.",
        "status": "collection_ready_not_yet_trained",
    },
}


def adapt(source_id: str, archive_path: str):
    """Translate one inspected archive. Raises until format checks are filled in."""
    info = DATASETS.get(source_id)
    if info is None:
        raise ValueError(f"Unknown source_id: {source_id}")
    if info["status"] == "not_downloaded":
        raise RuntimeError(
            f"{source_id} is not_downloaded. Obtain it through its official "
            f"route ({info['official_url']}), inspect a sample archive, and "
            f"only then implement this adapter's format checks. Refusing to guess."
        )
    raise NotImplementedError(
        f"Adapter for {source_id} is not yet implemented for archive {archive_path}. "
        "Fill in format checks after inspecting the real archive."
    )


if __name__ == "__main__":
    import json, sys
    print(json.dumps(DATASETS, indent=2))
    sys.exit(0)
