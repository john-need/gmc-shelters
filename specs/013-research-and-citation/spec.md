# Feature Specification: Research Search & Auto-Citation Improvements

**Feature Branch**: `013-research-and-citation`
**Created**: 2026-07-02
**Status**: Draft
**Input**: User description: "Search and auto-citation feature: research tab, OKF markdown conversion of collections PDFs, Chicago citations with quotes, page numbers, illustrations, OCR cleanup"

## Clarifications

### Session 2026-07-02

- Q: Header volume/edition — year+month or printed Vol./No.? → A: Both. `volume`/`edition` = year/month always; `printed_volume`/`printed_issue` when extractable. Citations prefer printed numbers.
- Q: Which Chicago system? → A: Notes-Bibliography (matches existing Sources tab).
- Q: Page numbers — printed vs PDF? → A: PDF page always (used for linking); printed page used in the citation when confidently extracted.
- Q: OCR cleanup approach? → A: LLM cleanup pass (Claude Haiku, escalating for bad scans), replacing spell-check. Spell-check verdict: **harmful — remove it.** pyspellchecker auto-substitutes wrong real words (Torrey→Torres, Loring→Losing, enterprise→spasm in `wiki/long-trail-news/1922_12_Dec.md`), corrupting proper nouns and quotes.
- Q: Publisher value? → A: Per-collection organization: "Green Mountain Club" for GMC publications, "Killington Section, Green Mountain Club" for section newsletters, "Rutland Historical Society" etc. for third-party items. Not hardcoded.
- Q: Illustrations scope? → A: Extract image files + captions. Captions searchable; images viewable.
- Q: LLM cost over ~1,120 PDFs? → A: Incremental + cached by source-PDF hash; corpus processed once, re-runs near-free.
- Q: Smoke & Blazes overlapping years (2013–2016 present in both source PDFs)? → A: Newer scan wins; duplicates from the 1948–2016 PDF are dropped.

## Current State (what this spec fixes vs. creates)

Most of the originally requested feature already exists:

- **Research tab** (`src/renderer/components/MainPane/tabs/ResearchTab.tsx`): FTS5 search with snippets, metadata display, and an "Add Citation" button.
- **Sources tab** (`SourcesTab.tsx`): Chicago Notes-Bibliography citation CRUD; `sources` + `shelter_sources` tables (quote column exists).
- **Conversion pipeline** (`scripts/ocr_to_markdown.py`): pdftotext → ocrmypdf fallback → pyspellchecker → OKF frontmatter → `wiki/`.
- **Smoke & Blazes splitter** (`collections/smoke-and-blazes/split_smoke_and_blazes.py`).
- **Search index** (`scripts/build_wiki_index.py` → `wiki/search.db`, whole-document FTS5).

This spec therefore covers **fixing and extending** that system:

1. Corrupted text: spell-check substitutes wrong real words; two-column scans have interleaved (broken) reading order.
2. No page tracking: markdown has no page markers, so page numbers in results/citations are currently impossible.
3. Incorrect OKF headers: wrong publisher, `date` instead of volume/edition, no author for books, unwanted tags.
4. No illustrations captured.
5. Smoke & Blazes duplicates across overlapping source PDFs.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Search results show page numbers and open the PDF at the right page (Priority: P1)

A staff member searching the research tab sees, for each hit: publication title, volume/edition (and printed Vol./No. when known), the PDF page number, and enough surrounding text to understand the context. Clicking the result's PDF link opens the original PDF at that page.

**Why this priority**: Page numbers are required for citations and are currently impossible; this is the core structural gap.

**Independent Test**: Search a term known to appear on an interior page of a Long Trail News issue; verify the result shows the correct PDF page and the link opens the PDF at that page.

**Acceptance Scenarios**:

1. **Given** an indexed newsletter, **When** staff search a phrase from page 3, **Then** the result shows page 3 and a context snippet containing the phrase.
2. **Given** a search result, **When** staff click its PDF link, **Then** the original PDF opens at that result's page.

---

### User Story 2 - One-click Chicago citation with quote and page (Priority: P1)

Staff select a search result and add it as a citation. A Chicago Notes-Bibliography source is created on the Sources tab for the current shelter with publication title, publisher, volume/issue (printed numbers when available, year/month otherwise), page number, and the result's quoted text stored as the quote.

**Independent Test**: From a search result, click Add Citation; verify the Sources tab shows a correctly formed Chicago NB entry with pages and quote populated.

**Acceptance Scenarios**:

1. **Given** a search result with page and metadata, **When** staff add a citation, **Then** a source is created with container title, publisher, volume, issue, pages, year, and the snippet stored as the quote in `shelter_sources.quote`.
2. **Given** a result whose printed volume/issue were extracted, **When** the citation is created, **Then** printed numbers are used in preference to year/month.

---

### User Story 3 - Clean, faithful text conversion (Priority: P1)

Re-running the conversion produces markdown whose text reads in correct column order, with OCR errors conservatively fixed, proper nouns preserved, and unreadable passages marked `[illegible]` — never silently replaced with plausible wrong words.

**Independent Test**: Re-convert `collections/long-trail-news/1922_12_Dec.pdf`; verify columns read in order, "Raymond H. Torrey" / "Benjamin Loring Young" / "Redfield Proctor" are intact, and no spell-check substitutions remain.

**Acceptance Scenarios**:

1. **Given** a two-column 1920s scan, **When** it is converted, **Then** the markdown reads in correct column order with page markers for every PDF page.
2. **Given** text the cleanup pass cannot confidently read, **When** it is converted, **Then** the passage is marked `[illegible]` rather than guessed.
3. **Given** an unchanged PDF, **When** the conversion re-runs, **Then** the document is skipped (hash match) with zero API calls.

---

### User Story 4 - Correct OKF headers (Priority: P2)

Every converted document carries the project's OKF profile header: per-collection publisher, `volume` (year) and `edition` (month/season), optional `printed_volume`/`printed_issue`, `author` for books, no `tags`, no `date`.

**Independent Test**: Inspect regenerated headers for a newsletter, a section newsletter, a third-party publication, and a book; verify each matches the profile.

**Acceptance Scenarios**:

1. **Given** a Long Trail News issue, **When** converted, **Then** the header has `publisher: "Green Mountain Club"`, `volume: "1922"`, `edition: "December"`, and no `tags` or `date` keys.
2. **Given** a book with an entry in its collection's `metadata.yaml`, **When** converted, **Then** the header includes `author`.
3. **Given** a Smoke & Blazes issue, **When** converted, **Then** `publisher: "Killington Section, Green Mountain Club"`.

---

### User Story 5 - Photos are findable (Priority: P2)

Illustrations are extracted as image files with their captions; captions are indexed so a search for caption text returns an illustration result showing the caption, publication, page, and the image itself.

**Independent Test**: Search a known photo caption; verify an illustration result appears with viewable image and correct page.

**Acceptance Scenarios**:

1. **Given** a converted document containing captioned photos, **When** staff search caption text, **Then** an illustration-type result appears with the caption, page, PDF link, and image preview.
2. **Given** a converted document, **When** viewing its markdown, **Then** it contains a "List of Illustrations" section with caption and PDF page per image.

---

### User Story 6 - Smoke & Blazes issues are split and deduplicated (Priority: P3)

Each Smoke & Blazes issue is its own markdown file. Where the 1948–2016 and 2013–2020 source PDFs contain the same issue, only the copy from the newer (cleaner) scan is kept.

**Acceptance Scenarios**:

1. **Given** an issue present in both source PDFs, **When** splitting runs, **Then** exactly one markdown file exists for it, sourced from the 2013–2020 PDF, and its `resource` points at that PDF.

### Edge Cases

- Printed page/volume numbers absent or illegible on old scans → citation falls back to PDF page and year/month; no guessing.
- A page with no recoverable text (image-only or destroyed) → page marker still emitted with `[illegible]` body so page numbering stays aligned.
- Splitter fails to detect an issue header in the 1948–1950 corrupted region → content merges into the previous issue (existing, accepted limitation); log a warning listing undetected regions.
- New PDF added to a collection → next conversion run processes only that file; index rebuild picks it up.
- LLM API unavailable mid-run → already-cleaned documents keep their cached output; failed documents are retried on the next run, never written half-cleaned.
- Illustration with no caption → listed as "Untitled illustration, p. N"; still viewable, not caption-searchable.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: PDFs under `collections/`; per-collection `collections/<name>/metadata.yaml` (organization, and per-file author/place/year for books).
- **Derived Outputs**: `wiki/**/*.md` (OKF profile markdown with page markers and illustration lists), extracted illustration image files, `wiki/search.db` (page-granular FTS5), conversion cache (source-PDF hash → cleaned output).
- **Out-of-Repo Consumers**: None. `wiki/` and `search.db` are consumed only by this app.

### Contracts & Operations

- **Contract Artifacts**: The OKF profile (below) is the contract between the conversion pipeline, the index builder, and the app.
- **Operator Documentation**: Conversion runbook: order is `ocr_to_markdown.py` → `split_smoke_and_blazes.py` → `build_wiki_index.py`; requires `ANTHROPIC_API_KEY` for cleanup pass.
- **Theme/External Code Boundary**: N/A.

### OKF Profile (project-defined; OKF itself only mandates `type`)

```yaml
type: "Newsletter" | "Book" | "Guidebook" | "Annual Report" | "Periodical" | ...
title: publication title
description: one-sentence summary
resource: relative path to source PDF
timestamp: ISO 8601 conversion time
language: "en"
publisher: per-collection organization
volume: year (always)
edition: month or season (always, when derivable)
printed_volume: as printed on the issue (optional)
printed_issue: as printed on the issue (optional)
author: required for books (from metadata.yaml)
pages: PDF page count
```

No `tags`. No `date`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Search results MUST show publication title, volume/edition (plus printed volume/issue when known), PDF page number, and a context snippet.
- **FR-002**: Each search result MUST link to the original PDF and open it at the result's page.
- **FR-003**: Adding a citation from a result MUST create a Chicago Notes-Bibliography source on the Sources tab with pages, volume/issue (printed preferred), publisher, year, and the quoted snippet stored with the citation.
- **FR-004**: Conversion MUST emit a page marker for every PDF page so that any text position maps to a PDF page.
- **FR-005**: Conversion MUST NOT use dictionary spell-check auto-correction. Text cleanup MUST fix reading order and obvious OCR errors only, MUST preserve proper nouns unless the correction is unambiguous in context, MUST never paraphrase, and MUST mark unreadable text `[illegible]`.
- **FR-006**: Conversion MUST be incremental: documents whose source PDF hash is unchanged are skipped (including all LLM calls).
- **FR-007**: Headers MUST follow the OKF profile above; publisher comes from the collection's `metadata.yaml`; books MUST include `author`.
- **FR-008**: Conversion MUST extract illustrations as image files with captions (caption via vision detection; fallback "Untitled illustration"), list them per document with PDF page, and the index MUST make captions searchable as illustration-type results.
- **FR-009**: Each newsletter edition MUST be its own markdown file; Smoke & Blazes combined PDFs MUST be split per issue, with newer-scan-wins deduplication across the two overlapping source PDFs.
- **FR-010**: The search index MUST be page-granular (one indexed row per page) so page numbers come from the index, not post-hoc lookup.
- **FR-011**: A quality heuristic (e.g., garbled-word ratio) MUST score converted documents and flag low-quality ones for escalation (stronger model or re-OCR with deskew/rotation).

### Key Entities

- **Document**: one publication edition; OKF profile header + page-marked body + illustration list; derived from exactly one source PDF (or one split region of a combined PDF).
- **Page**: unit of search indexing; belongs to a document; carries PDF page number.
- **Illustration**: extracted image + caption + PDF page; belongs to a document; searchable by caption.
- **Source / Quote**: existing `sources` and `shelter_sources` records; gain populated `pages`, `volume`, `issue` from search results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of search results display a PDF page number, and their PDF links open at that page.
- **SC-002**: Citations added from search results require zero manual edits for publication, publisher, volume/edition, page, and quote fields.
- **SC-003**: Zero dictionary-substitution errors in regenerated text: the known corruptions in `1922_12_Dec.md` (Torrey, Loring Young, Redfield Proctor, enterprise) all read correctly after re-conversion.
- **SC-004**: Re-running conversion on an unchanged corpus completes with zero LLM API calls.
- **SC-005**: Searching the caption of a known photo returns that illustration within the top results.
- **SC-006**: Exactly one markdown file exists per Smoke & Blazes issue in the overlapping 2013–2016 range.

## Assumptions

- Internal staff desktop app; single user; no concurrency concerns.
- Claude API access (Haiku-class model) is acceptable for the cleanup and caption passes; cost bounded by one-time corpus processing plus new PDFs.
- The existing `sources`/`shelter_sources` schema is sufficient; no new citation tables.
- Existing splitter limitation for corrupted 1948–1950 Smoke & Blazes headers is accepted for v1.
- `wiki/` output and `search.db` may be regenerated destructively at any time; the PDFs and `metadata.yaml` are the durable sources of truth.
