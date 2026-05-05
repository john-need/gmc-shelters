# Feature Specification: [FEATURE NAME]

**Feature Branch**: `[###-feature-name]`  
**Created**: [DATE]  
**Status**: Draft  
**Input**: User description: "$ARGUMENTS"

## User Scenarios & Testing *(mandatory)*

<!--
  User stories must be prioritized, independently testable, and usable as
  incremental delivery slices.
-->

### User Story 1 - [Brief Title] (Priority: P1)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]
2. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 2 - [Brief Title] (Priority: P2)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

### User Story 3 - [Brief Title] (Priority: P3)

[Describe this user journey in plain language]

**Why this priority**: [Explain the value and why it has this priority level]

**Independent Test**: [Describe how this can be tested independently]

**Acceptance Scenarios**:

1. **Given** [initial state], **When** [action], **Then** [expected outcome]

---

[Add more user stories as needed, each with an assigned priority]

### Edge Cases

- What happens when [boundary condition]?
- How does system handle [error scenario]?
- How is rerun behavior handled when the same import/sync input is processed twice?

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: [Identify the repository data, SQLite tables, markdown, and/or local assets that are authoritative for this feature]
- **Derived Outputs**: [List any generated files, exports, payloads, or remote side effects produced from those inputs]
- **Out-of-Repo Consumers**: [List WordPress endpoints, templates, APIs, operators, or other consumers outside this repository]

### Contracts & Operations

- **Contract Artifacts**: [List required files under `specs/[###-feature-name]/contracts/` or state N/A]
- **Operator Documentation**: [List the quickstart or README updates operators will need]
- **Theme/External Code Boundary**: [State what stops at a documented contract because the target code is not stored in this repo]

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST [specific capability]
- **FR-002**: System MUST [specific capability]
- **FR-003**: Users or operators MUST be able to [key interaction]
- **FR-004**: System MUST [data requirement]
- **FR-005**: System MUST [behavior]
- **FR-006**: For import or sync behavior, the system MUST detect already-processed inputs and avoid duplicate side effects. [Delete if not applicable]
- **FR-007**: For external integrations, the system MUST expose a documented contract and operator steps before rollout. [Delete if not applicable]

### Key Entities *(include if feature involves data)*

- **[Entity 1]**: [What it represents, key attributes without implementation]
- **[Entity 2]**: [What it represents, relationships to other entities]

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: [Measurable metric]
- **SC-002**: [Measurable metric]
- **SC-003**: [If applicable, rerunning the same sync/import produces zero duplicate side effects]
- **SC-004**: [If applicable, operator reporting accounts for all processed items]

## Assumptions

- [Assumption about target users or operators]
- [Assumption about scope boundaries]
- [Assumption about repository-owned data or local assets]
- [Assumption about external systems that consume outputs but are not implemented in this repo]
