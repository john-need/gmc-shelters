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

- If a second instance is launched, the existing window is focused and the new process exits — no duplicate windows are permitted.
- The initial scaffold makes no network calls, so network connectivity has no effect on launch or operation.
- Tests that require a live Electron context are isolated to the main-process test directory (`node` environment); renderer tests run in `jsdom` and never import Electron-specific APIs directly.
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
- **FR-011**: The renderer process MUST run with `contextIsolation` enabled; all renderer↔main communication MUST use IPC through a typed API bridge exposed via a preload script — direct Node.js access from the renderer is prohibited
- **FR-012**: The application MUST enforce a single running instance; if a second launch is attempted, the existing window MUST be brought to the foreground and the new process MUST exit immediately
- **FR-013**: The application MUST write structured logs to stdout during development; in production builds, logs MUST be written to a rotating local log file in the OS-appropriate user data directory
- **FR-014**: The test suite MUST use a `node` environment for main-process tests and a `jsdom` environment for renderer-process tests, configured per directory so each runs without requiring a live Electron window
- **FR-015**: The application MUST include a native OS menu bar with: an app menu containing About and Quit; an Edit menu with standard clipboard shortcuts; and a Window menu with Minimize and Zoom
- **FR-016**: The renderer process MUST use React as its UI rendering layer
- **FR-017**: The application MUST use Redux Toolkit (RTK) for global state management, using `createSlice` and `createAsyncThunk` — plain Redux action creators are not used
- **FR-018**: All UI components MUST be built using the Material UI component library for visual consistency
- **FR-019**: The application MUST define a minimal custom MUI theme with brand primary and secondary colors and base typography; all other design tokens inherit MUI defaults
- **FR-020**: The renderer MUST include a client-side router; the initial scaffold MUST wire up a root route pointing to the splash/home screen so that future screens can be added as additional routes without restructuring
- **FR-021**: The renderer process MUST be bundled using Vite; the development server MUST support hot module replacement (HMR) so UI changes are reflected without a full app restart
- **FR-022**: The application MUST use electron-forge with its Vite plugin for packaging and distribution; the forge config MUST cover development startup, production build, and creation of platform-specific distributables
- **FR-023**: The splash/home screen MUST serve as the persistent root route; it does not auto-dismiss — it remains the visible screen until a subsequent feature introduces additional routes

### Key Entities

- **Application Window**: The main desktop window that hosts the application UI; has a title, dimensions, and lifecycle events (open, close, minimize)
- **Source Module**: A TypeScript file under `src/` that implements part of the application; belongs to either the main process (Node.js environment) or renderer process (browser-like environment)
- **Test Suite**: A collection of test files that verify the behavior of source modules; runnable independently of a live desktop session
- **Lint Configuration**: A set of rules applied uniformly to all TypeScript source files to enforce code quality and style
- **React Component**: A UI building block rendered in the renderer process; composed into pages and layouts using Material UI primitives
- **Redux Store**: The central state container for the application; holds app-level state accessible to any React component
- **MUI Theme**: Design token configuration (colors, typography, spacing) applied globally to all Material UI components

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The application window opens within 5 seconds of launching in development mode on a standard developer machine
- **SC-002**: All scaffolding tests pass when the test command is run against a freshly cloned repository with dependencies installed
- **SC-003**: The lint command completes with zero errors on the initial scaffold codebase
- **SC-004**: A new developer can install dependencies, launch the app, run tests, and run the linter by following the README — without prior knowledge of the project — in under 15 minutes
- **SC-005**: The packaged application can be built and run on macOS, Windows, and Linux
- **SC-006**: In production, application errors and crashes are captured in a local log file discoverable without attaching a debugger

## Clarifications

### Session 2026-05-15

- Q: What Electron security model should the scaffold use? → A: `contextIsolation: true`, preload script exposes API bridge via `contextBridge`, IPC for all main↔renderer communication
- Q: What should happen when a second app instance is launched? → A: Enforce single instance — focus the existing window and exit the new process immediately
- Q: What error/crash logging strategy should the scaffold include? → A: Structured logs to stdout in development; rotating local log file in production — no external service
- Q: What Jest test environment should the scaffold use? → A: Split — `node` environment for main-process tests, `jsdom` for renderer tests, configured per directory
- Q: Should the scaffold include a native OS menu bar? → A: Yes — minimal menu: app menu (About, Quit), Edit (clipboard shortcuts), Window (Minimize, Zoom)
- Stack addition: renderer UI uses React; global state managed with Redux; UI components from Material UI
- Q: Redux Toolkit or plain Redux? → A: Redux Toolkit (RTK) — `createSlice`, `createAsyncThunk`, Immer included
- Q: MUI theme depth? → A: Minimal custom theme — primary/secondary brand colors and base typography; all other tokens inherit MUI defaults
- Q: Include React Router in the scaffold? → A: Yes — wire up a root router with a single splash/home route; all future screens add routes without restructuring

### Session 2026-05-15 (continued)

- Q: What build tool should bundle the renderer process? → A: Vite — fast HMR, minimal config, TypeScript-native
- Q: What Electron packaging tool should handle distribution builds? → A: electron-forge with Vite plugin — official tooling, native Vite integration, unified dev+build+publish lifecycle
- Q: Does the splash screen auto-dismiss or serve as the persistent home screen? → A: Splash is the home screen — root route renders it permanently until future screens are added

## Assumptions

- The Electron app lives at the project root alongside the existing Python scripts and SQLite database; it does not replace them
- The initial scaffold is a working shell — a functioning window with placeholder content — not a fully featured application
- The `src/` directory will contain both main-process code (Node.js) and renderer-process code (UI), organized into subdirectories as the app grows
- Existing Python tooling and shell scripts at the project root are out of scope for this feature and will not be modified
- The development environment is macOS; cross-platform packaging concerns are noted but not the primary focus of this initial scaffold
- TypeScript compilation errors are treated as test failures — the build must be type-safe
