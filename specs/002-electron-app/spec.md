# Feature Specification: Electron Desktop Application

**Feature Branch**: `002-electron-app`  
**Created**: 2026-05-15  
**Status**: Draft  
**Input**: User description: "add an electron app to this repo. the current project root will be the electron app root. put all source code for the electron app in a src folder. the name of the app is gmc-shelters. add jest for testing. use typescript. add eslint."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Launch Desktop Application (Priority: P1)

A developer or administrator opens the GMC Shelters desktop application on their computer. The application window launches and presents the main interface for managing shelter data.

**Why this priority**: The core value of an Electron app is that it runs as a native desktop application. Without this working, nothing else matters.

**Independent Test**: Open the app binary/dev-server command and verify a window appears with the correct application name.

**Acceptance Scenarios**:

1. **Given** the application is installed or in development mode, **When** the user launches the app, **Then** a desktop window opens with the title "gmc-shelters"
2. **Given** the application is running, **When** the user closes the main window, **Then** the application exits cleanly without errors

---

### User Story 2 - Run Automated Tests (Priority: P1)

A developer runs the test suite to verify application code is working correctly before committing changes.

**Why this priority**: Testing infrastructure is a first-class requirement and must be in place from the start to support quality development.

**Independent Test**: Run the test command from the project root and observe results — all scaffolding tests pass, and the framework reports a summary.

**Acceptance Scenarios**:

1. **Given** the project dependencies are installed, **When** the developer runs the test command, **Then** the test runner executes all tests and reports pass/fail results
2. **Given** a source file is changed, **When** tests are run, **Then** only the relevant tests are re-evaluated
3. **Given** a test fails, **When** the developer reviews output, **Then** the failure message clearly identifies the failing assertion and the file/line

---

### User Story 3 - Lint Source Code (Priority: P2)

A developer runs the linter to check code quality and style consistency across all TypeScript source files.

**Why this priority**: Consistent code style prevents technical debt and helps teams maintain readability as the codebase grows.

**Independent Test**: Run the lint command; verify it reports no errors on the scaffolded source files, and that it flags intentionally bad code.

**Acceptance Scenarios**:

1. **Given** the project dependencies are installed, **When** the developer runs the lint command, **Then** all TypeScript files under `src/` are checked and results reported
2. **Given** a source file contains a style violation, **When** linting runs, **Then** the file path, line number, and rule name are reported
3. **Given** all source files conform to the configured rules, **When** linting runs, **Then** the command exits with a success code

---

### User Story 4 - Build for Distribution (Priority: P3)

A developer or CI pipeline produces a distributable package of the application for delivery to end users.

**Why this priority**: Distribution is needed for actual use but is lower priority than the development scaffolding being correct and testable.

**Independent Test**: Run the build command and verify a distributable artifact is produced in the output directory.

**Acceptance Scenarios**:

1. **Given** the build command is run, **When** it completes, **Then** a packaged application artifact is produced
2. **Given** the packaged artifact is launched, **When** the user opens it, **Then** the application behaves identically to the development version

---

### Edge Cases

- What happens when the application is launched while another instance is already running?
- How does the app behave when launched with no network connectivity?
- What happens when a test file imports a module that requires a live Electron context?
- How does linting handle files that are auto-generated or in `node_modules`?

## Source of Truth & External Impact *(mandatory)*

### Canonical Inputs

- **Source Data**: TypeScript source files under `src/`, project configuration files (`package.json`, `tsconfig.json`, ESLint config, Jest config) at the project root
- **Derived Outputs**: Compiled JavaScript (for development), packaged application binaries (for distribution), test result reports, lint reports
- **Out-of-Repo Consumers**: End users who install and run the packaged desktop application; CI/CD pipelines that run tests and linting

### Contracts & Operations

- **Contract Artifacts**: N/A — this feature establishes the application scaffold; contracts with other system components will be defined as those integrations are built
- **Operator Documentation**: README updates covering how to install dependencies, run the app in development mode, execute tests, and run the linter
- **Theme/External Code Boundary**: The Electron packaging and desktop OS integration stop at the application window boundary; the OS itself is not in scope

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The application MUST launch as a native desktop window with the name "gmc-shelters"
- **FR-002**: All application source code MUST reside under the `src/` directory at the project root
- **FR-003**: The project MUST be written in TypeScript with strict type checking enabled
- **FR-004**: Developers MUST be able to run the full test suite with a single command from the project root
- **FR-005**: Developers MUST be able to lint all TypeScript source files with a single command from the project root
- **FR-006**: The linter MUST enforce consistent code style rules across all source files under `src/`
- **FR-007**: The test framework MUST be able to run tests in isolation without requiring a live desktop window
- **FR-008**: The project MUST include a `package.json` with clearly named scripts for: starting the app in development, running tests, and running the linter
- **FR-009**: The project MUST include a build script that produces a distributable application artifact
- **FR-010**: The initial application window MUST display a branded splash screen with the application name "gmc-shelters"; data integration is deferred to subsequent features

### Key Entities

- **Application Window**: The main desktop window that hosts the application UI; has a title, dimensions, and lifecycle events (open, close, minimize)
- **Source Module**: A TypeScript file under `src/` that implements part of the application; belongs to either the main process (Node.js environment) or renderer process (browser-like environment)
- **Test Suite**: A collection of test files that verify the behavior of source modules; runnable independently of a live desktop session
- **Lint Configuration**: A set of rules applied uniformly to all TypeScript source files to enforce code quality and style

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The application window opens within 5 seconds of launching in development mode on a standard developer machine
- **SC-002**: All scaffolding tests pass when the test command is run against a freshly cloned repository with dependencies installed
- **SC-003**: The lint command completes with zero errors on the initial scaffold codebase
- **SC-004**: A new developer can install dependencies, launch the app, run tests, and run the linter by following the README — without prior knowledge of the project — in under 15 minutes
- **SC-005**: The packaged application can be built and run on macOS, Windows, and Linux

## Assumptions

- The Electron app lives at the project root alongside the existing Python scripts and SQLite database; it does not replace them
- The initial scaffold is a working shell — a functioning window with placeholder content — not a fully featured application
- The `src/` directory will contain both main-process code (Node.js) and renderer-process code (UI), organized into subdirectories as the app grows
- Existing Python tooling and shell scripts at the project root are out of scope for this feature and will not be modified
- The development environment is macOS; cross-platform packaging concerns are noted but not the primary focus of this initial scaffold
- TypeScript compilation errors are treated as test failures — the build must be type-safe
