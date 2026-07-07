# Feature Specification: Clean Up Quote

**Feature Branch**: `016-cleanup-quote`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "I need the ability to \"clean up\" a quote on the sources page. this is the same procedure as clean up for a collection document but for a quote in a citation source on the sources tab. this will only change the quote, not the wiki markdown file. this will require a claude API key, if the key is invalid, disable the icon button that launches the clean up. use a title like \"clean up quote\" and \"clean up quote (requires AI API key)\" if disabled."

## Clarifications

### Session 2026-07-07

- Q: What should "invalid API key" mean for disabling the Clean up quote button? → A: Format check only — valid means a non-empty key matching the existing `sk-ant-` format check used on the AI Settings page today; no live call to Anthropic just to light the button. Real auth failures surface through the User Story 3 error path when clean-up actually runs.
- Q: Where should the "Clean up quote" icon button live? → A: On the source card's existing action row, alongside view/edit/delete — not inside the edit-source modal. Clicking it runs clean-up and saves the corrected quote immediately, with no draft-vs-saved ambiguity.
- Q: Should clicking the button run clean-up immediately, or ask for confirmation first (given it overwrites the quote and spends API credits)? → A: Run immediately, no confirmation dialog — consistent with the one-click flow already described in User Story 1.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean up a messy quote (Priority: P1)

A researcher has pasted or OCR'd a quote into a citation source on the Sources tab, and the text has line-break artifacts, OCR errors, or other formatting noise. They want a one-click way to have the quote corrected using the same AI clean-up already used for collection documents, without touching anything else about the source or its underlying wiki markdown file.

**Why this priority**: This is the entire value of the feature — everything else exists to support this action safely.

**Independent Test**: On a source with a quote, click "Clean up quote," confirm the quote text is corrected in place, and confirm the source's wiki markdown file and every other source field are unchanged.

**Acceptance Scenarios**:

1. **Given** a source with a quote containing OCR/formatting noise, **When** the user clicks the "Clean up quote" icon button, **Then** the system sends the quote to Claude for clean-up and replaces the quote field with the corrected text once it returns.
2. **Given** a clean-up is in progress for a source, **When** the user looks at that source's icon button, **Then** it shows a busy/in-progress state and cannot be clicked again until the clean-up finishes.
3. **Given** a clean-up has completed successfully, **When** the user views the source, **Then** only the quote field has changed — title, citation fields, annotation, and the source's associated wiki markdown file are untouched.
4. **Given** a source has no quote text, **When** the user views that source, **Then** no "Clean up quote" button is shown for it.

---

### User Story 2 - Button reflects API key availability (Priority: P2)

A user without a configured (or with an invalid) Claude API key should not be able to start a clean-up that will only fail. The icon button should visibly communicate why it can't be used.

**Why this priority**: Prevents confusing failures and wasted clicks; depends on User Story 1's button existing.

**Independent Test**: Remove/invalidate the API key in AI Settings, return to the Sources tab, and confirm the "Clean up quote" button is disabled with the title "Clean up quote (requires AI API key)". Add a valid key and confirm the button becomes enabled with the title "Clean up quote".

**Acceptance Scenarios**:

1. **Given** no Claude API key is configured, **When** the user views a source with a quote, **Then** the "Clean up quote" icon button is disabled and its title reads "Clean up quote (requires AI API key)".
2. **Given** an invalid Claude API key is configured, **When** the user views a source with a quote, **Then** the button is disabled with the same "requires AI API key" title.
3. **Given** a valid Claude API key is configured, **When** the user views a source with a quote, **Then** the button is enabled and its title reads "Clean up quote".
4. **Given** the button is enabled, **When** the user updates the API key to an invalid or empty value while the Sources tab stays open, **Then** the button reflects the new disabled state without requiring the app to restart.

---

### User Story 3 - Clean-up failure is recoverable (Priority: P3)

If the clean-up call fails (network error, API error, rate limit), the user's original quote must not be lost, and the user should know it didn't work.

**Why this priority**: Protects existing data; lower priority than the happy path but still required before shipping.

**Independent Test**: Force a clean-up call to fail (e.g., temporarily invalid key or simulated network error) and confirm the original quote text is still present and an error is surfaced to the user.

**Acceptance Scenarios**:

1. **Given** a clean-up request fails, **When** the failure occurs, **Then** the source's quote field remains exactly as it was before the click and an error message is shown to the user.
2. **Given** a clean-up request fails, **When** the user dismisses the error, **Then** the "Clean up quote" button returns to its normal clickable state (assuming the API key is still valid).

### Edge Cases

- What happens when the user closes the Sources tab or navigates away while a clean-up is still running? The in-flight request should still complete and update the stored quote; if the tab is reopened afterward, the corrected quote is shown.
- What happens if the quote is very short (e.g., a few words) or already clean? The system still runs the same clean-up call; a no-op result (unchanged text) is an acceptable outcome, not an error.
- What happens if two clean-up requests are triggered for the same source in quick succession? The button's busy state (User Story 1, Scenario 2) prevents a second click from starting a duplicate request while one is in flight.
- How does the system distinguish "no key" from "invalid key" for the disabled title? Both cases show the same "requires AI API key" title — the user does not need a separate message to know the fix (go configure a valid key).

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The `quote` field of a citation source record (SQLite-backed), and the configured Claude API key/model used elsewhere in the app for AI clean-up.
- **Derived Outputs**: The updated `quote` value written back to the source record. No files are generated or modified.
- **Out-of-Repo Consumers**: None — this feature does not touch the wiki markdown file or any published/exported artifact; it only affects the citation source's stored quote text.

### Contracts & Operations

- **Contract Artifacts**: N/A — this reuses the existing internal AI clean-up capability and API key configuration; no new external contract is introduced.
- **Operator Documentation**: None beyond the existing AI Settings documentation for configuring the API key.
- **Theme/External Code Boundary**: N/A.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a "Clean up quote" icon button in each source card's existing action row (alongside view/edit/delete) on the Sources tab, for every citation source that has a non-empty quote.
- **FR-002**: When clicked, the system MUST send only that source's quote text through the same AI clean-up procedure used for collection documents, and MUST replace the source's quote field with the corrected result on success.
- **FR-003**: The clean-up action MUST NOT modify any other field of the source (title, citation fields, annotation, include-in-history flag, etc.) or the associated wiki markdown file.
- **FR-004**: The system MUST disable the "Clean up quote" button when no Claude API key is configured or the configured key does not match the existing `sk-ant-` format check, and MUST set its title to "Clean up quote (requires AI API key)" in that state.
- **FR-005**: The system MUST enable the "Clean up quote" button and set its title to "Clean up quote" when a key matching that format check is configured. This is a format check, not a live confirmation that the key authenticates with Anthropic — a well-formed but revoked/incorrect key still enables the button, and that failure is handled by FR-007 (User Story 3) on first use.
- **FR-006**: The system MUST show a busy/in-progress state on the button while a clean-up request for that source is running, and MUST prevent starting a second concurrent clean-up for the same source during that time.
- **FR-007**: If the clean-up request fails, the system MUST leave the stored quote unchanged and MUST surface an error to the user.

### Key Entities

- **Citation Source**: An existing entity on the Sources tab with a `quote` field (free text) among its other citation fields. This feature reads and, on success, overwrites only that field.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can clean up a quote in a single click, with the corrected text visible within the same time the existing collection-document clean-up takes for a comparable amount of text.
- **SC-002**: 100% of clean-up runs that modify a quote leave every other source field and the wiki markdown file byte-for-byte unchanged.
- **SC-003**: When no valid API key is present, 100% of "Clean up quote" buttons are disabled and labeled "Clean up quote (requires AI API key)" — zero clean-up attempts can be started in this state.
- **SC-004**: When a clean-up request fails, the original quote is preserved in 100% of cases and the user sees an error every time.

## Assumptions

- "Invalid key" means the same client-side format check already used on the AI Settings page (non-empty, starts with `sk-ant-`); no new live-validation mechanism is introduced.
- The clean-up procedure itself (prompt, model, correction behavior) is the same one already used for collection documents — this feature is a new trigger/target for that existing procedure, not a new AI behavior.
- "Same procedure as clean up for a collection document" means the same correction goals (fix OCR errors, reading-order/formatting noise) applied to a single short text field instead of a full document; it does not include the collection clean-up's illustration-captioning behavior, which does not apply to plain quote text.
- The button appears per-source, not as a bulk action across all sources, matching how quotes are edited individually today.
- Only sources with a non-empty quote show the button; sources without a quote have nothing to clean up.
