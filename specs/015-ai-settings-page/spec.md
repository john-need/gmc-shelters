# Feature Specification: AI Settings Page

**Feature Branch**: `015-ai-settings-page`
**Created**: 2026-07-07
**Status**: Draft
**Input**: User description: "add a new page to the settings menu. \"AI settings\". move the claude API key setting to this page. Add the ability to change the model with a dropdown"

## Clarifications

### Session 2026-07-07

- Q: What exact list of Claude models should appear in the dropdown? → A: Dropdown offers exactly the two models already wired into the pipeline today (the current default/fast model and the current escalation/capable model) — operator picks which one is the primary model.
- Q: After the API key field moves off Collections, what should remain there regarding the AI-key dependency? → A: Keep the explanatory text on Collections and add a link/button that jumps directly to the new AI Settings page.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Find AI configuration in its own place (Priority: P1)

An operator managing this app wants to configure the Anthropic API key that powers OCR cleanup and photo captioning. Today that field is buried inside the Collections page alongside file-processing controls. They want a dedicated "AI Settings" entry in the Settings menu so AI configuration is easy to find and doesn't get lost among unrelated collection-management controls.

**Why this priority**: Without this, the rest of the feature has nowhere to live. This is the foundational structural change.

**Independent Test**: Open Settings, confirm an "AI Settings" entry appears in the navigation, click it, and confirm the API key field is present there and no longer appears on the Collections page.

**Acceptance Scenarios**:

1. **Given** the Settings menu is open, **When** the operator looks at the navigation list, **Then** an "AI Settings" item is present alongside the existing items (Publishing, Architectures, Shelter categories, Paths, Collections, About).
2. **Given** the operator clicks "AI Settings", **When** the page loads, **Then** the Anthropic API key field (with its current save/reveal/remove behavior) is shown on this page.
3. **Given** the operator opens the Collections page, **When** they look for the API key field, **Then** it is no longer there, but the existing explanatory text about needing a key is still present alongside a link that jumps directly to AI Settings.

---

### User Story 2 - Choose which Claude model performs AI processing (Priority: P2)

An operator wants to control which Claude model is used for the app's AI-powered processing (OCR cleanup and photo captioning), trading off cost, speed, or quality, without editing any files or code.

**Why this priority**: This is the new capability the user explicitly asked for, but it depends on the AI Settings page existing first (User Story 1).

**Independent Test**: On the AI Settings page, open the model dropdown, select a different supported model, and confirm the choice is saved and still selected after reopening the page or restarting the app.

**Acceptance Scenarios**:

1. **Given** the operator is on the AI Settings page, **When** they view the model control, **Then** a dropdown lists the Claude models the app supports for AI processing, with the currently active model pre-selected.
2. **Given** the operator selects a different model from the dropdown, **When** the selection is made, **Then** the app saves the choice immediately without requiring a separate "save" action for the model.
3. **Given** a model has been selected, **When** the app is closed and reopened, **Then** the AI Settings page still shows that model as selected.
4. **Given** a model has been selected, **When** the operator next runs OCR cleanup or photo captioning, **Then** that run uses the selected model.

---

### Edge Cases

- What happens if no API key has been saved yet? The model dropdown should still be usable and save a preference independently of key presence (a model choice can be made before or after the key is entered).
- What happens if the previously selected model is no longer in the supported list (e.g., after an app update removes an option)? The app falls back to the default supported model and reflects that in the dropdown.
- How does the system handle a first run where no model preference has ever been saved? It defaults to the app's current default model, matching today's fixed behavior.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The locally stored AI configuration (Anthropic API key and selected model preference) that both the desktop app and the local conversion pipeline read from.
- **Derived Outputs**: None new — OCR cleanup output (cleaned document text) and photo caption output are unchanged in kind; only the model that produces them becomes operator-selectable.
- **Out-of-Repo Consumers**: The Anthropic API (unchanged — already an external consumer of the key and model selection).

### Contracts & Operations

- **Contract Artifacts**: N/A — this is a local configuration UI change; no new external-facing contract is introduced.
- **Operator Documentation**: The existing "AI Integration" / Anthropic API key guidance (currently shown inline on the Collections page) moves with the field to the new AI Settings page; wording should be updated to no longer reference Collections-specific context. The Collections page retains a short explanatory note plus a link to AI Settings so operators aren't left at a dead end.
- **Theme/External Code Boundary**: N/A.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Settings navigation MUST include an "AI Settings" entry, distinct from the existing "Collections" entry.
- **FR-002**: The AI Settings page MUST present the Anthropic API key field (view masked, reveal, save, and remove), preserving its current validation (key must start with `sk-ant-` when non-empty) and its current storage/precedence behavior (local storage, `ANTHROPIC_API_KEY` environment variable overrides).
- **FR-003**: The Collections page MUST no longer present the Anthropic API key field once it is relocated.
- **FR-003a**: The Collections page MUST keep its existing explanatory text about the API key being required for cleanup/captioning, and MUST add a link or button that navigates the operator directly to the AI Settings page.
- **FR-004**: The AI Settings page MUST present a dropdown listing exactly the two Claude models already wired into the app's AI-powered processing today — the current default (fast/cheap) model and the current escalation (more capable) model — letting the operator choose which of the two is used as the primary model.
- **FR-005**: The dropdown MUST show the currently active model as selected when the page loads.
- **FR-006**: Selecting a different model from the dropdown MUST persist that choice locally so it survives an app restart.
- **FR-007**: Subsequent AI-powered processing runs (OCR cleanup, photo captioning) MUST use the persisted selected model rather than a fixed value.
- **FR-008**: If no model preference has been saved yet, or the saved preference is no longer one of the two supported models, the system MUST fall back to the app's current default model.

### Key Entities

- **AI Configuration**: Represents the operator's AI setup for this app — the Anthropic API key and the selected model. Read by both the desktop app UI and the local processing pipeline that performs OCR cleanup and photo captioning.
- **Supported Model**: One of exactly two Claude models the app already calls today (the default/fast model and the escalation/capable model); has a display name and is either the current selection or not.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can locate and open AI Settings from the Settings menu in one click from the Settings navigation, without searching through unrelated pages.
- **SC-002**: 100% of existing API key management actions (save, reveal, remove) continue to work identically after relocation, with zero loss of previously saved keys during the transition.
- **SC-003**: An operator can change the active AI model in a single interaction (one dropdown selection), with no additional save step required.
- **SC-004**: A selected model choice remains in effect across at least one full app restart, 100% of the time.

## Assumptions

- A single model selection applies globally to all AI-powered processing in the app (OCR cleanup and photo captioning share one setting); this feature does not introduce separate per-feature model choices.
- The list of selectable models is a fixed set of exactly the two models already wired into the pipeline today (not free-text entry, not a broader catalog); expanding that list is a future concern, not part of this feature.
- Choosing a model in the dropdown sets it as the primary model used for AI-powered processing. Exactly how the pipeline's existing internal escalation logic interacts with a manually-selected primary model (e.g., whether escalation still applies on top of it) is an implementation detail left to the planning phase, not a separate user-facing control in this feature.
- "AI Settings" is the correct label for the new navigation entry, matching the user's wording; the existing "Collections" entry keeps its current label and scope (collection/file management only).
- No new permissions, external accounts, or network endpoints are introduced — this reuses the existing Anthropic API key and existing API call paths.
