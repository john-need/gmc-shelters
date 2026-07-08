# Feature Specification: Generate History

**Feature Branch**: `019-generate-history`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "Add a new feature, \"Generate History\" Add a button on the history tab, after the \"source\", \"both\", \"preview\" buttons. this button will gather the information from the shelter tab, and the citations on the sources tab, and whatever is currently in the history panel, and send off a prompt to claude to write a factual history of the [shelter name] give these facts. Tell it to add its own research. When the results come back, show the user the new narrative in a modal window in markdown preview mode. Give the user to chance to accept or reject the new history narrative. if the user accepts, replace the history on this history tab. otherwise discard the new narrative."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draft a new history narrative from current facts (Priority: P1)

A researcher has entered a shelter's basic facts on the Shelter tab and added citations on the Sources tab, and wants a well-written narrative history rather than writing prose from scratch. They click "Generate History" and Claude drafts a factual account of the shelter using those facts, the included citations, and whatever is already on the History tab, supplemented with its own research.

**Why this priority**: This is the entire value of the feature — everything else exists to make this draft safe to use.

**Independent Test**: On a shelter with name, architecture, built-by, and notes filled in on the Shelter tab and at least one citation marked for inclusion on the Sources tab, click "Generate History" and confirm a narrative is returned that reflects those facts.

**Acceptance Scenarios**:

1. **Given** a shelter with facts on the Shelter tab and included citations on the Sources tab, **When** the user clicks "Generate History," **Then** the system sends those facts, the included citations, and the current History tab content to Claude with an instruction to write a factual narrative history and to add its own relevant research.
2. **Given** a generation request is in progress, **When** the user looks at the "Generate History" button, **Then** it shows a busy/in-progress state and cannot be clicked again until the request finishes.
3. **Given** the History tab currently has no content (a new/blank history), **When** the user clicks "Generate History," **Then** the system still sends the available Shelter-tab facts and citations (with an empty history) and returns a narrative.

---

### User Story 2 - Review and accept the generated narrative (Priority: P1)

Once Claude returns a draft, the user wants to see exactly what will replace the existing history, formatted the way it will actually read, before committing to it.

**Why this priority**: Replacing a shelter's history is a meaningful, hard-to-casually-undo edit; review before applying is core to the feature being trustworthy.

**Independent Test**: Trigger a generation, confirm the result appears in a modal rendered as formatted (not raw) markdown, click Accept, and confirm the History tab's content is replaced with the generated narrative.

**Acceptance Scenarios**:

1. **Given** Claude has returned a generated narrative, **When** the response arrives, **Then** the system shows it in a modal window rendered in markdown preview mode (headings, lists, emphasis, links formatted, not shown as raw markdown source).
2. **Given** the generated narrative is shown in the review modal, **When** the user clicks Accept, **Then** the History tab's content is replaced with the generated narrative and the tab reflects it as an unsaved edit, exactly as if the user had typed it in — the existing Save action still governs writing it to disk.
3. **Given** the review modal is open, **When** the user clicks Accept, **Then** the modal closes and the History tab (in whichever view mode is active) shows the new content.

---

### User Story 3 - Reject the generated narrative (Priority: P2)

The user reviews the draft and decides it isn't right — wrong emphasis, invented details they don't want, or just not an improvement — and wants to keep what they had with zero side effects.

**Why this priority**: Protects existing content; the feature is only safe to use freely if rejecting is truly a no-op.

**Independent Test**: Trigger a generation, click Reject (or close the modal) in the review step, and confirm the History tab's content and dirty/saved state are byte-for-byte unchanged from before the click.

**Acceptance Scenarios**:

1. **Given** the review modal is showing a generated narrative, **When** the user clicks Reject (or dismisses the modal), **Then** the generated narrative is discarded, the History tab's content is unchanged, and its dirty/saved indicator is unchanged.
2. **Given** the user has rejected a narrative, **When** they click "Generate History" again, **Then** a new independent request is sent (the rejected draft is not reused or referenced).

---

### Edge Cases

- Generation request fails (network error, API error, timeout, rate limit): the History tab's content is left exactly as it was, no modal is shown, and an error is surfaced to the user.
- No Claude API key configured, or the configured key does not match the existing format check used elsewhere in the app: the "Generate History" button is disabled with a title indicating an AI API key is required; no request is attempted.
- User closes/navigates away from the History tab while a generation request is in flight: the request still completes; if the review modal would have appeared, it appears once the user returns to the History tab (or the result is discarded if the shelter selection has since changed — see Assumptions).
- User has unsaved edits in the source editor when they click "Generate History": those in-progress edits are what gets sent as "current history panel content" (not the last-saved file), so the draft is grounded in what the user is actively looking at.
- Shelter tab facts are mostly blank: generation still proceeds using whatever is filled in, and Claude is instructed to research the rest rather than fabricate specifics it isn't given.
- No citations are marked for inclusion on the Sources tab: generation still proceeds using only Shelter tab facts, current history content, and Claude's own research.
- User triggers "Generate History" a second time while a request is already running: the button's busy state prevents a second concurrent request (same pattern as the existing single-source AI actions in this app).

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The selected shelter's fields on the Shelter tab (name, architecture, built-by, notes, and other displayed facts), the citations on the Sources tab marked for inclusion in the history (the same `include_in_history` selection already used to compile this document's existing Sources section), the History tab's current content (including unsaved edits), and the configured Claude API key/model already used elsewhere in the app.
- **Derived Outputs**: An ephemeral generated narrative, held only in the review modal until the user accepts or rejects it. On accept, it becomes the History tab's in-editor content (an unsaved edit like any other); nothing is written to disk until the user explicitly saves, matching today's History tab behavior.
- **Out-of-Repo Consumers**: None. The Anthropic API is called as an external generation service; its output is never treated as canonical shelter data until a human reviews and accepts it.

### Contracts & Operations

- **Contract Artifacts**: N/A — this reuses the existing internal AI call capability and API key/model configuration already established for other AI actions in this app; no new external contract is introduced.
- **Operator Documentation**: None beyond the existing AI Settings documentation for configuring the API key.
- **Theme/External Code Boundary**: N/A.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The History tab MUST show a "Generate History" button positioned after the existing "Source," "Both," and "Preview" view-mode buttons.
- **FR-002**: When clicked, the system MUST gather the current shelter's Shelter-tab facts, the Sources-tab citations marked for inclusion in the history, and the History tab's current content (including unsaved edits), and send them to Claude with an instruction to write a factual narrative history of the shelter from those facts and to add its own relevant research.
- **FR-003**: The system MUST NOT modify the History tab's content in any way until the user explicitly accepts a generated narrative.
- **FR-004**: On receiving a generated narrative, the system MUST display it in a modal window rendered in markdown preview mode.
- **FR-005**: The review modal MUST offer exactly two actions: accept the narrative or reject it; dismissing the modal without an explicit accept MUST be treated as reject.
- **FR-006**: If the user accepts, the system MUST replace the History tab's current content with the generated narrative, marking it as an unsaved edit consistent with normal manual edits, without altering any other tab's data.
- **FR-007**: If the user rejects, the system MUST discard the generated narrative entirely, leaving the History tab's content and dirty/saved state exactly as they were before the request.
- **FR-008**: The system MUST show a busy/in-progress state on the "Generate History" button while a request is running and MUST prevent starting a second concurrent request for the same shelter during that time.
- **FR-009**: The system MUST disable the "Generate History" button when no Claude API key is configured or the configured key does not match the existing format check used elsewhere in the app, with a title indicating an AI API key is required.
- **FR-010**: If the generation request fails (network error, API error, timeout), the system MUST leave the History tab's content unchanged and MUST surface an error to the user; no review modal is shown for a failed request.

### Key Entities

- **Generated History Narrative (draft)**: The markdown text Claude returns for a single "Generate History" click. Exists only in memory for the review modal; becomes the History tab's content on accept, or is discarded on reject/dismiss. Never persisted or logged as a distinct record.
- **Shelter Facts Snapshot**: The point-in-time bundle of Shelter-tab fields, included Sources-tab citations, and current History-tab content assembled at the moment the button is clicked; not stored, used only to build that one request.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can go from clicking "Generate History" to either accepting or rejecting the result in a single review step, with no more than one click needed for either outcome.
- **SC-002**: 100% of rejected (or dismissed) narratives leave the History tab's content and dirty/saved state unchanged.
- **SC-003**: 100% of accepted narratives fully replace the prior History tab content, leaving the change unsaved until the user explicitly saves, matching existing History tab save behavior.
- **SC-004**: When no valid API key is configured, 100% of attempts are blocked at the button (disabled, correctly labeled) with zero requests sent.
- **SC-005**: When a generation request fails, the existing history content is preserved in 100% of cases and the user sees an error every time.

## Assumptions

- "The citations on the sources tab" means citations marked for inclusion in the history (the existing `include_in_history` flag), the same set already used to compile this document's Sources section — not every citation ever recorded for the shelter.
- Accepting a generated narrative behaves like a normal in-editor edit: it updates the History tab's content and dirty state but does not implicitly save to disk; the existing Save action still governs persistence.
- The "Generate History" button uses the same API key/model configuration, format-check-based enable/disable rule, and busy-state convention already established for other AI actions in this app, rather than introducing new configuration.
- The button is available wherever the "Source/Both/Preview" toggle is available today (i.e., not shown in the "history file missing" state) — matching where it's positioned per the user's request.
- This feature does not create new citation records from Claude's own added research; supplementary research is narrative context only, not turned into new Sources-tab entries.
- Only one generation request may be in flight at a time per shelter; no history of past generated drafts is retained beyond the currently open review modal.
- If the user navigates to a different shelter while a request is in flight, the result is discarded on arrival rather than shown for the wrong shelter (avoids narratives appearing against the wrong shelter's History tab).
