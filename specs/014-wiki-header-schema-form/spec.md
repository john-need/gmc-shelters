# Feature Specification: Schema-Driven Wiki Header Editor

**Feature Branch**: `014-wiki-header-schema-form`
**Created**: 2026-07-03
**Status**: Draft
**Input**: User description: "UI changes to editing wiki markdown file headers. Do not allow users to edit entire header in a single text block. Establish a schema for the header based on citation type. Provide the user with controls to set each property in the schema for each citation type. Citation type should be set on the collection level. Present the user with a form that allows the user to edit the header properties without the risk of breaking the header format or violating the schema. Choose an appropriate control for each schema property."

## Clarifications

### Session 2026-07-03

- Q: The header also has a separate legacy `type` field (a publication-format label like "Periodical" or "Book", distinct from `citation_type`) — should the new schema-driven form let operators edit it, treat it as read-only/preserved, or auto-derive it from citation type on save? → A: Read-only/preserved — the form does not expose `type` as an editable field; its existing on-disk value is written back unchanged on every save.

## Current State (what this spec fixes vs. creates)

The wiki header editor already exists (`CollectionsManagementPage.tsx`'s "Edit header" button opens a dialog backed by the `wiki:getHeader` / `wiki:saveHeader` IPC calls). Today it presents the entire YAML frontmatter block as one plain-text `<textarea>`: the user can type anything, and the only validation before save is that the block still starts and ends with `---` fences. Nothing stops a user from misspelling a property name, leaving a required property out, entering a value of the wrong shape (e.g., text in a numeric field), or picking a citation type that isn't one of the values the rest of the app understands (search filtering and citation generation both key off `citation_type`).

Separately, the file-conversion pipeline (`scripts/lib/wiki_convert.py`) already supports reading a `citation_type` from a collection's `metadata.yaml`, falling back to a per-collection-folder default when absent — but nothing in the UI lets an operator set that value; it must be hand-edited in the YAML file today.

This spec replaces the free-text header editor with a schema-driven form, and adds a collection-level control for citation type.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Edit a file's header with per-property controls (Priority: P1)

An operator opens the header editor for a wiki file and sees each header property (title, description, publisher, volume, pages, citation type, etc.) as its own labeled field with a control suited to that property, instead of one large text box. They change a value, and the system either accepts it and writes a correctly formatted header, or blocks the save and explains exactly what's wrong.

**Why this priority**: This is the core problem — the current single-textarea editor lets operators corrupt the header, breaking search and citations for that file. Removing that risk is the reason the feature exists.

**Independent Test**: Open the header editor for an already-converted wiki file, change the title and the page count through their respective controls, save, and confirm the underlying markdown file's frontmatter reflects the change while every other property and the document body are untouched.

**Acceptance Scenarios**:

1. **Given** a wiki file with an existing header, **When** the operator opens the header editor, **Then** every header property is shown in its own field, pre-filled with the file's current value, using a control appropriate to that property's data (e.g., a single-select for citation type, a numeric input for page count, a single-line text input for title).
2. **Given** the header editor is open, **When** the operator clears a required property and attempts to save, **Then** the save is blocked and the operator sees which property is missing, without the file being modified.
3. **Given** the header editor is open, **When** the operator enters a value in an unexpected shape for a property (e.g., non-numeric text in the page count field), **Then** the control itself prevents or flags the invalid entry before save is attempted.
4. **Given** valid changes to one or more properties, **When** the operator saves, **Then** the file's frontmatter is rewritten with correctly formatted YAML containing exactly the schema's properties and the document body is left unchanged.

---

### User Story 2 - Header form adapts to the selected citation type (Priority: P2)

An operator changes a file's citation type within the header editor (e.g., from "magazine" to "map") and the set of fields shown updates to match what that citation type actually needs — a map doesn't need a volume/issue pair, an interview doesn't need page count in the same way a periodical does. Properties that no longer apply are hidden; properties newly required for the chosen type appear.

**Why this priority**: Citation type is the organizing concept the user asked for the schema to be built around; without type-dependent fields, the form is just the old textarea with checkboxes — it doesn't stop operators from filling in nonsensical combinations, and it doesn't guide them toward what's actually needed for a correct citation.

**Independent Test**: Open the header editor for a file, switch its citation type from one value to another with a different field set, and confirm the visible fields change accordingly and previously entered values for fields common to both types are retained.

**Acceptance Scenarios**:

1. **Given** the header editor is open with citation type "magazine" selected, **When** the operator switches citation type to "map", **Then** fields not applicable to maps (e.g., volume, issue) are removed from the form and any fields required only for maps appear.
2. **Given** a value was entered in a field that is shared between two citation types, **When** the operator switches between those two types, **Then** the shared field's value is preserved.
3. **Given** a value was entered in a field that does not exist for the newly selected citation type, **When** the operator saves, **Then** that value is not written into the file's header.

---

### User Story 3 - Set a collection's default citation type (Priority: P3)

An operator viewing the Collections Management page sets the citation type for an entire collection once (e.g., "GMC Annual Reports" → report), instead of fixing it file-by-file. Files newly added to the wiki from that collection use this default; the operator can still override the citation type for an individual file afterward without affecting the collection setting or other files.

**Why this priority**: Citation type is fundamentally a property of the source material (a newsletter collection is always a magazine-type citation), so setting it once per collection avoids repetitive, error-prone per-file entry — but it's an efficiency improvement layered on top of User Story 1, which is usable on its own.

**Independent Test**: Set a citation type on a collection that has no citation type configured yet, add a new file from that collection to the wiki, and confirm the new file's header is created with that citation type without the operator entering it manually.

**Acceptance Scenarios**:

1. **Given** a collection with no citation type set, **When** the operator sets one from the Collections Management page, **Then** the setting is saved against that collection.
2. **Given** a collection's citation type has been set, **When** a file from that collection is added to the wiki, **Then** the new file's header is created with the collection's citation type.
3. **Given** a file whose header citation type was set individually (User Story 1/2) to something other than its collection's default, **When** the collection's default is later changed, **Then** the already-converted file's header is left untouched until an operator opens and re-saves it in the header editor.

---

### Edge Cases

- Opening the header editor for a file that hasn't been added to the wiki yet: no header exists to edit (existing behavior in the current dialog — retained, not part of this feature's scope).
- Header editor is open when the underlying file is deleted or moved out from under it (e.g., another operator runs a collection rename): save must fail safely with a clear message rather than corrupting or recreating the file.
- A file's on-disk header contains a citation type value that isn't one of the schema's known types (e.g., hand-edited before this feature existed, or corrupted): the form must still open, surface the unrecognized value distinctly, and require the operator to choose a valid type before saving changes.
- A file's on-disk header is missing a property the schema considers required for its citation type (e.g., converted before that property existed): the form opens with that field empty and flags it as needing attention, consistent with normal required-field validation.
- Operator switches citation type back and forth repeatedly before saving: only the final selection and its currently-visible field values are written.

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: The YAML frontmatter block at the top of each converted wiki markdown file under `wiki/`; each collection's `metadata.yaml` file under `collections/`.
- **Derived Outputs**: None beyond the header text itself — this feature edits canonical files directly rather than generating a separate artifact.
- **Out-of-Repo Consumers**: None. Headers are consumed only by this application's own search indexing and citation features, both already implemented.

### Contracts & Operations

- **Contract Artifacts**: N/A — no new external integration or API surface is introduced.
- **Operator Documentation**: The Collections Management page's in-app description should mention the new collection-level citation type control; no separate operator guide is required.
- **Theme/External Code Boundary**: N/A — no code outside this repository is affected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST define, for every citation type supported by the wiki (the existing set used by search and citation generation: book, chapter, journal, newspaper, magazine, website, archive, manuscript, interview, map, report, other), which header properties are required, which are optional, and which do not apply.
- **FR-002**: The header editor MUST present each applicable header property as an individual, labeled form control rather than as part of a single free-text block.
- **FR-003**: The header editor MUST select a control type appropriate to each property's data (for example: a single-select list for citation type and language; a single-line text input for short text such as title, publisher, or author; a multi-line text input for description; a numeric input for counts such as pages, volume, or issue; a read-only display for properties the system derives automatically or preserves unchanged, such as file path, conversion timestamp, and the legacy `type` field).
- **FR-004**: When the operator changes a file's citation type within the header editor, the system MUST update the set of visible/required fields to match the newly selected type's schema, preserving values already entered for any field shared between the previous and new type.
- **FR-005**: The system MUST validate all property values against the active citation type's schema before saving — required properties present, values in the expected shape — and MUST prevent the save and clearly identify the problem when validation fails.
- **FR-006**: On a successful save, the system MUST write a header containing exactly the properties defined by the active citation type's schema (plus any system-derived properties), formatted as valid frontmatter, and MUST NOT alter the document body.
- **FR-007**: The system MUST allow an operator to set a citation type at the collection level, and MUST use that value as the default citation type when a file from that collection is added to the wiki.
- **FR-008**: The system MUST allow a file's own citation type, once set (via the header editor or at conversion time), to differ from its collection's current default, and an individual file's header value MUST take precedence over the collection default whenever the two differ.
- **FR-009**: Changing a collection's default citation type MUST NOT modify the on-disk headers of files already converted from that collection; the new default MUST apply only to files added to the wiki after the change.
- **FR-010**: If a file's stored citation type or any stored property value does not match the current schema (e.g., an unrecognized citation type, or a required property missing), the header editor MUST still open, MUST visibly flag the non-conforming value(s), and MUST require the operator to correct them before the header can be saved again.
- **FR-011**: The header editor MUST NOT present the legacy `type` field (the OKF publication-format label distinct from `citation_type`) as an editable property; on save, the system MUST write back whatever `type` value already existed in the file's header, unchanged.

### Key Entities

- **Header Schema**: Defines, per citation type, the list of header properties, whether each is required or optional, and the kind of value each property holds. Governs which fields the editor shows and how it validates them.
- **Citation Type**: A category describing what kind of source a file is (book, magazine, map, report, etc.); determines which Header Schema applies. Already used elsewhere in the app for search and citation formatting.
- **Collection Citation Type Setting**: A single citation type value associated with a collection, used as the default for files added to the wiki from that collection.
- **Wiki File Header**: The set of property values stored in a given wiki file's frontmatter; edited through the schema-driven form and validated against the Header Schema for its current citation type. Includes the legacy `type` property, which is preserved unchanged by the form rather than governed by the Header Schema.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Operators editing a wiki file's header never type or hand-format YAML syntax — every edit is made through a labeled control for a single property.
- **SC-002**: 100% of attempts to save a header with a missing required property or a value in the wrong shape are blocked before the file is modified, with the specific problem identified to the operator.
- **SC-003**: After a collection's citation type is set, newly added files from that collection require zero manual citation-type entry.
- **SC-004**: For any citation type, an operator can determine which header properties are required versus optional entirely from what the form shows them, without consulting code or documentation.
- **SC-005**: Files converted before this feature existed, including any with non-conforming or missing property values, can still be opened and corrected in the header editor rather than failing to load.

## Assumptions

- "Citation type" refers to the existing `citation_type` classification already used by the wiki search and citation-generation code (book, chapter, journal, newspaper, magazine, website, archive, manuscript, interview, map, report, other) — this feature organizes the header schema around that existing vocabulary rather than introducing a new one.
- System-derived header properties (file path/resource, conversion timestamp, page count) remain automatically managed and are shown read-only in the form rather than becoming editable fields, since they reflect facts about the source file rather than editorial judgments.
- This feature covers the per-file header editor and the per-collection citation-type setting only; it does not change how PDFs are converted to markdown, how search indexing works, or how citations are generated downstream — those consume whatever the header contains and are otherwise out of scope.
- Only one citation type is active per file at a time; a file cannot belong to multiple citation types simultaneously.
- **Per-file override vs. collection lock**: a file's own citation type can be individually overridden and always wins over its collection's default (FR-008), since collections can plausibly contain one or two outlier source types (e.g., a map scanned into an otherwise all-newsletter collection).
- **Retroactivity of collection default changes**: changing a collection's default citation type does NOT rewrite already-converted files' headers (FR-009) — only files added afterward pick up the new default.
