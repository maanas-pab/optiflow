# Inside OptiFlow — tab specification

Navigation label: **Inside OptiFlow**

Route: `/inside-optiflow`

Purpose: explain the product's approach, research foundations, dataset provenance, methodology, and actual evidence status. This is a content/implementation specification, not an implemented app route.

## Design

Keep the established ivory, sage, lavender, muted blue, and peach palette. Use generous spacing, readable charcoal text, thin dividers, and calm typography. Place an abstract halo beside the introductory copy; this page does not need camera permission.

Use a compact sticky section navigation: Our approach · How it works · Research · Data · Open source · Validation · Privacy. On mobile, use a simple section menu. All content remains keyboard accessible and usable without animation.

## Introductory panel

Eyebrow: Science, design, and evidence

Headline: **See the signals. Understand the limits.**

Body: Explore the research behind OptiFlow, the experience we are building, and how we plan to test it.

Show a development-status label driven by the actual release state. This kit defaults to “Research and implementation plan.” Do not change it to “Clinically validated,” “Research proven,” or “AI certified.”

## Our approach

Render four pillars from content.json: Observe, Explain, Reflect, Reset.

Feature the proposed **Pulse Portrait**: an optional camera-derived pulse estimate rendered as a waveform and ambient halo. Credit the existing rPPG research. Describe the user experience as OptiFlow's design contribution; never claim OptiFlow invented webcam pulse sensing.

Add a “What we are contributing” panel using PAGE_COPY.md. Treat its product claims as intended behavior until implemented.

## How it works

Use an accessible five-step diagram:

Camera → quality checks → measured signals → optional evaluated model → user-confirmed reflection and next step.

Provide a source badge for each displayed output:
- **Observed**: derived from camera/task measurements.
- **Self-reported**: entered by the user.
- **Estimated**: produced by an identified model with an appropriate evidence record.

Do not conflate quality coverage with prediction confidence.

## Research library

Load `source_catalog/papers.json`. Search by title, author, year, and topic. Display title, credited researchers, year, link, proposed role, caveat, and project-use status. Allow expandable notes rather than dense walls of text.

Offer “View source” and “Copy citation.” Bibliographic entries in references.bib are pointer entries; preserve version-specific author notes. Do not embed full paper text unless separately permitted.

## Datasets

Load all six requested records from datasets.json. Display:
- Name, researchers/creators, institution/origin.
- Data modality and label type.
- Proposed use and key mismatch/limitation.
- Official source and access link.
- Access/rights note.
- Referenced / Used for training / Evaluated status, independently represented.

Keep download status separate from usage status. A downloaded dataset has not necessarily trained a model. Public cards should never expose local file paths or private consent records.

## Open-source credits

Load repositories.json. Display repository name, maintainer/community credit, role, GitHub link, and usage status. If integrated, show pinned version/commit and relevant notices. Mark current entries “Research reference.”

Do not present researchers or maintainers as OptiFlow partners, advisers, or endorsers without authorization. Do not use institutional logos as implied endorsement.

## Methodology and validation

Display the seven methodology steps in content.json. Include the distinction between unseen-person testing and later-session personalization testing.

Initially show: **“OptiFlow model evaluation is pending.”**

Explain that synthetic fixture checks validate code behavior only. Do not fill metric cards with sample accuracy numbers. Once real evaluations exist, show endpoint, real participant count, source, split, metric, uncertainty where available, rejection coverage, model version, and date.

## Privacy

Before implementation, label privacy copy “Design requirements.” After implementation, publish only verified behavior. Explain frame processing, saved summaries, optional exports, retention, deletion, and any network calls. On-device processing and anonymity are different claims.

## Acceptance criteria

- Every named requested dataset and repository is represented.
- All paper cards retain author/source metadata.
- Search and filters operate on the JSON catalogs.
- External links are accessible; failures are disclosed rather than replaced with fabricated sources.
- Status badges match evidence records.
- No unverified global-first, clinical, endorsement, or accuracy claims appear.
- The page remains consistent with actual app features as development progresses.
