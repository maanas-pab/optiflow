# OptiFlow builder kit — start here

This folder is coding context, source attribution, a data-acquisition plan, and a model-development specification. It is **not a pretrained model or a bundle of the external human datasets**.

## What is included

- All six requested dataset records, with researchers, origin, labels, access routes, limitations, and current usage status.
- Twenty-one research entries: twenty papers/reports plus the NASA-TLX instrument resource.
- Twelve repository records, including all eight repositories in the user's list (sklearn-onnx and ONNX Runtime are separate repositories).
- The earlier research pack, collection templates, and 3,225 synthetic engineering signal samples.
- Machine-readable JSON catalogs and bibliographic pointer entries.
- An `Inside OptiFlow` tab content file, design specification, methodology copy, and attribution rules.
- A training runbook, task definitions, and a copyable coding-LLM kickoff prompt.

## What is not included

- Raw UTA-RLDD, CogBeacon, YawDD, UBFC-rPPG, COHFACE, or UBFC-Phys archives.
- Complete paper PDFs, copyrighted article reproductions, repository source clones, or pretrained weights.
- A trained OptiFlow model or measured OptiFlow prediction accuracy.
- Evidence that the proposed product is globally unique or first of its kind.

Download/access links are provided. Some data require accounts, approval, or permission; some archives are large. Check permissions before training or distributing model weights. Never silently replace unavailable data with fabricated human labels.

## Give the coder these files

1. Open `CODER_KICKOFF.md` as the task prompt.
2. Attach `LLM_CONTEXT.md` for the complete earlier research and engineering guidance.
3. Attach `source_catalog/` for structured source records and credits.
4. Attach `TRAINING_RUNBOOK.md` and `training_tasks.json` for the actual ML workflow.
5. Attach `inside-optiflow/` for the additional app tab.

If the coding assistant can access a folder, provide the entire folder. If it only accepts files, provide `BUILDER_CONTEXT.md`, then the JSON catalogs and data files when implementing those components.

## What “learning” means here

The coding LLM reads these files as context and uses them to write better-informed code. Attaching the folder does not permanently update its weights, perform reinforcement learning, or make the sensor model more accurate by itself.

The application predictor learns when an explicit training job fits a model to permitted labeled examples. The saved model must then be evaluated, exported, and integrated. Accuracy can improve or worsen; only held-out measurements establish the difference.

Personal adaptation is a separate later step using prior confirmed responses. Store corrections without claiming that each correction instantly retrains a model.

## Current evidence state

All external sources are marked `research_reference`. All six external datasets are `not_downloaded`. All repositories are `integrated=false`. The ten synthetic fixture checks passed; those results do not establish human measurement or fatigue-prediction accuracy.

Preserve these states until the coder produces the corresponding implementation, training manifest, or evaluation report.
