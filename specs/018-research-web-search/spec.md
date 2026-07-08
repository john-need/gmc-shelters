# Feature Specification: Research Tab Web Search Citations

**Feature Branch**: `018-research-web-search`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "on the research tab add a checkbox to the search box card 'search web' when checked, this will query claude with a prompt 'research information about [search terms]. return a list of primary sources. look for photos if appropriate'. this should return a list of sources that will then be added the search results in research. For photos, add small thumbnail. Adding these citations will add them to the sources tab just like the collection sources."

## Clarifications

### Session 2026-07-07

- Q: When should the web research query actually fire? → A: Only on an explicit manual trigger — a "Search Web" button next to the search input. Editing the query text never fires a call on its own; this bounds the number of paid Claude API calls to one per deliberate staff action.
- Q: Is a separate "Search web" checkbox needed alongside the button? → A: No — removed. The button alone is both the gate and the trigger; one visible action instead of two, with no behavior lost (editing text still can't fire a call; only a click can).
- Q: Where do web results appear relative to the existing archive results? → A: In their own separate, distinctly labeled section, not merged into the archive results list.
- Q: When Claude's research finds a photo, what can staff do with it? → A: It is shown as a small reference thumbnail on that result/citation only; it is not imported into the shelter's managed photo library.
- Q: Should the number of web results per query be capped? → A: No — the Web Sources section shows every primary source Claude returns for the query, with no artificial cap.
- Q: Should a minimum query length gate the (now-manual) web search action? → A: Not applicable — the trigger changed from auto-debounce to a manual "Search Web" button, which already bounds calls to one per deliberate click regardless of query length.
- Q: Should photo thumbnails hotlink the external URL Claude returns, or be fetched/cached locally? → A: Fetched and cached locally; the UI renders the local copy rather than hotlinking, avoiding exposing staff network/IP to arbitrary third-party sites on every render.
- Q: Should the Search Web button be disabled while a request is already in flight? → A: Yes — disabled until the in-flight request resolves, so repeated clicks can't fire multiple concurrent paid API calls.
- Q: Should the web search request time out? → A: Yes — after roughly 30-60 seconds an unresolved request is treated as failed, the existing inline error state is shown, and the Search Web button re-enables so staff can retry.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Turn on web research alongside archive search (Priority: P1)

A staff member researching a shelter is on the Research tab with the archive search box. They enter their search terms and click a "Search Web" button to ask Claude to research those terms. Claude returns a short list of primary sources (and photos, when found), shown in their own section beneath the existing archive results.

**Why this priority**: This is the entry point for the whole feature — without it, nothing else is reachable.

**Independent Test**: Type a search term, click Search Web, and confirm a distinctly labeled "Web Sources" section appears with results, while the existing archive results section continues to behave as before.

**Acceptance Scenarios**:

1. **Given** the Research tab, **When** staff enter a query and click the Search Web action, **Then** a separate, clearly labeled section of web results appears in addition to (not replacing) the archive search results.
2. **Given** the query text is edited alone (no click), **Then** no web query is sent; the web section only refreshes once staff click the Search Web action again.

---

### User Story 2 - Cite a web-found source (Priority: P1)

A staff member sees a promising result in the Web Sources section and adds it as a citation. It becomes a source on the Sources tab for the current shelter, the same way a citation added from an archive result does.

**Why this priority**: Finding sources is only useful if they can be captured as citations; this is the payoff of the feature.

**Independent Test**: From a web result, click Add Citation; confirm a new entry appears on the Sources tab for the current shelter with the result's identifying details filled in.

**Acceptance Scenarios**:

1. **Given** a web result, **When** staff click its Add Citation action, **Then** a source record is created for the current shelter and appears on the Sources tab alongside citations added from archive results.
2. **Given** a web result that includes a photo, **When** staff add it as a citation, **Then** the citation is created the same way as one without a photo (the photo remains a reference thumbnail on the result, not a required field).

---

### User Story 3 - See a photo thumbnail when one is found (Priority: P2)

While reviewing web results, a staff member sees a small thumbnail image next to any result for which Claude located a relevant photo, helping them quickly judge relevance before opening the source or adding it as a citation.

**Why this priority**: Valuable for quickly assessing results, but the feature is still useful without it (text-only results still support citation).

**Independent Test**: Run a web search known to surface a photo-bearing source; confirm a small thumbnail renders next to that result and not next to text-only results.

**Acceptance Scenarios**:

1. **Given** a web result with a located photo, **When** the Web Sources section renders, **Then** a small thumbnail is shown alongside that result's details.
2. **Given** a web result with no located photo, **When** the Web Sources section renders, **Then** the result displays normally with no thumbnail placeholder.

---

### Edge Cases

- No Anthropic API key/model configured yet: clicking Search Web shows a clear message directing the operator to AI Settings, instead of failing silently or crashing.
- Web query returns zero primary sources: the Web Sources section shows a distinct "no web results" state, separate from the existing "no results" message for archive search.
- Staff try to click Search Web again while a request is in flight: the action is disabled and cannot be clicked until the current request resolves, preventing duplicate concurrent paid calls.
- Staff never click Search Web: no API call is ever made and no cost is incurred; the section stays empty/absent until they explicitly trigger a search.
- Claude API call fails (network error, rate limit, invalid key): the Web Sources section shows an inline error state; the archive results section continues to work normally.
- Claude does not respond within roughly 30-60 seconds: the request times out, is treated the same as a failed call (inline error state), and the Search Web button re-enables for a retry.
- A web result has no usable link or title: it is omitted from the results rather than shown as a broken/empty entry.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The staff member's current search query text; the app's already-configured Anthropic API key and selected model (from AI Settings, spec 015).
- **Derived Outputs**: New `sources` / `shelter_sources` records when staff use Add Citation on a web result — same schema and tables used by existing archive citations; no new tables or fields. Locally cached copies of photo thumbnail images fetched from web results, stored on disk (not hotlinked from the external source).
- **Out-of-Repo Consumers**: The Anthropic API, now also called live from the desktop app itself (previously only called by the offline conversion pipeline for OCR cleanup/captioning).

### Contracts & Operations

- **Contract Artifacts**: N/A — reuses the existing `sources`/`shelter_sources` schema; no new external contract is introduced.
- **Operator Documentation**: Note that this feature requires an Anthropic API key and model already configured via AI Settings (spec 015); no separate setup is introduced.
- **Theme/External Code Boundary**: N/A.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Research tab's search box card MUST include a "Search Web" action (e.g. a button), next to the existing archive search input.
- **FR-002**: When staff explicitly trigger the Search Web action with a non-empty query, the system MUST send a live research request to Claude asking it to research the current search terms, return a list of primary sources, and look for photos when appropriate.
- **FR-003**: The web research request MUST fire only on the explicit Search Web action — editing the query text alone MUST NOT trigger a call, unlike the existing local archive search's auto-debounce behavior.
- **FR-004**: Web results MUST render in their own clearly labeled section, visually separate from the archive results list, not merged into it.
- **FR-005**: Each web result MUST show enough information to identify the source (at minimum a title and a link to the primary source).
- **FR-006**: When a web result includes a located photo, the system MUST fetch and cache the image locally and display the small thumbnail from that local copy — never by hotlinking the external URL directly; results without a photo MUST render without one.
- **FR-007**: Each web result MUST offer an Add Citation action that creates a source record for the current shelter, using the same citation-creation flow already used for archive results.
- **FR-008**: A citation added from a web result MUST appear on the Sources tab identically to (same list, same fields) a citation added from an archive result.
- **FR-009**: If no Anthropic API key/model is configured, clicking Search Web MUST surface a clear message directing the operator to AI Settings rather than failing silently.
- **FR-010**: If a web query returns no primary sources, the system MUST show a distinct empty state for the Web Sources section (not the same message used for "no archive results").
- ~~FR-011, FR-012~~: Removed — both were checkbox-dependent (uncheck-clears-the-section; a stale-response race only reachable via an uncheck/recheck cycle). With the checkbox removed, neither applies; numbering is left as-is rather than renumbering every requirement below.
- **FR-013**: The Web Sources section MUST display every primary source Claude returns for the query, with no artificial cap on result count; the section scrolls the same way the archive results list already does when results exceed the visible area.
- **FR-014**: While a web query is in flight, the Web Sources section MUST show a loading indicator scoped to that section; the archive results section MUST remain unaffected and interactive during this time.
- **FR-015**: The Search Web action MUST be disabled while a request is already in flight, so repeated clicks cannot fire multiple concurrent paid API calls; it MUST re-enable once that request resolves (success, empty, error, or timeout).
- **FR-016**: A web search request MUST time out after roughly 30-60 seconds if Claude has not responded; a timed-out request MUST be treated as failed (the existing inline error state from FR-009/edge cases) and the Search Web button MUST re-enable so staff can retry.

### Key Entities

- **Web Research Result**: A single Claude-sourced finding for one search query — title, link to the primary source, optional short summary/snippet, optional locally cached thumbnail image. The result record itself is not persisted; exists only for the current query in the Research tab. A cached thumbnail image file may outlive the query on local disk (see Assumptions).
- **Source / Citation** (existing entity, unchanged shape): gains entries created from Web Research Results, indistinguishable in structure from entries created from archive results.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can start web research and see a labeled Web Sources section without leaving the Research tab or performing any setup beyond clicking the Search Web action.
- **SC-002**: 100% of web results that include a located photo display a thumbnail; 100% of those without one display cleanly without a placeholder.
- **SC-003**: Adding a citation from a web result requires no more manual steps than adding one from an archive result.
- **SC-004**: When no Anthropic API key is configured, 100% of Search Web attempts show a clear next step instead of a silent failure.
- ~~SC-005~~: Removed — was checkbox-dependent (uncheck-clears-the-section); no longer applicable.
- **SC-006**: 100% of Search Web clicks while a request is already in flight are no-ops (button disabled), so no shelter's search ever produces more than one concurrent paid API call; any unresolved request fails over to the error state within roughly 30-60 seconds.

## Assumptions

- This feature reuses the Anthropic API key and model preference already configured via AI Settings (spec 015); no new credential UI is introduced.
- Web results are ephemeral and session-only; nothing is persisted unless staff explicitly use Add Citation, which writes to the existing `sources`/`shelter_sources` tables.
- Discovered photos are reference thumbnails on the web result/citation only; importing them into the shelter's managed photo library/editor pipeline is out of scope for this feature.
- The fixed research prompt ("research information about [search terms]. return a list of primary sources. look for photos if appropriate.") is the entire instruction given to Claude for v1; no additional steering (e.g., domain allow-lists, source-type filters) is in scope.
- Repeat/duplicate web citations are handled the same (unrestricted) way duplicate archive citations are handled today; no new dedupe logic is introduced.
- The web search fires only on the explicit Search Web action, so cost is bounded to one Anthropic API call per deliberate click rather than per keystroke; no minimum query length is needed to control cost.
- Cached thumbnail image files are treated as disposable local cache (comparable to other local caches in this app, e.g. the photo thumbnail cache from spec 010); no expiry/cleanup policy is specified by this feature beyond not growing unbounded within a single research session.
