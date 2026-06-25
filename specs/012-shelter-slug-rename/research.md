# Research: Safe Shelter Slug Renames

No open `NEEDS CLARIFICATION` items remain from the Technical Context — this feature reuses entirely existing patterns in the codebase. Each decision below was settled by inspecting current code rather than by evaluating external alternatives, since the goal is to close a consistency gap in an existing workflow, not introduce new technology.

## Decision: Reuse `fs.rename` for the folder move, not copy+delete

**Rationale**: `src/main/fs/photos.ts` already has a copy+delete pattern (`movePhotoFile`) for moving a single file *between* shelter folders (needed because cross-device moves and per-file collision handling matter there). A slug rename is a same-parent directory rename — `fs.rename` on the shelter's own folder is atomic on the same filesystem/volume, simpler, and faster than recursively copying every photo. `ensureShelterDir`/`deleteShelterDir` already resolve the same `{sheltersRoot}/{slug}` path shape this needs.
**Alternatives considered**: Recursive copy + delete old folder (rejected: slower, not atomic, and unnecessary — slug renames don't cross filesystem/volume boundaries the way a "move photo to another shelter" might conceptually need to).

## Decision: DB transaction first, then disk rename, with DB rollback on disk failure

**Rationale**: The uniqueness check is a real DB constraint; running the DB transaction first means a duplicate-slug rejection never touches the filesystem at all (cheaper failure path). If the disk rename then fails (e.g., permissions), the DB transaction has already committed, so the fix is to re-run the inverse UPDATE (swap old/new) inside a second transaction and rethrow — same approach already used nowhere else in this repo verbatim, but consistent with `deleteShelter`'s use of `db.transaction()` for multi-table consistency.
**Alternatives considered**: Disk-first then DB (rejected per the user's explicit approach — would require renaming a folder back on a DB error, which still needs the same rollback logic but pays the disk I/O cost even for what's usually a sub-millisecond rejection).

## Decision: Sanitize server-side only, in `updateShelter`

**Rationale**: The renderer's `ShelterTab.tsx` slug input is free text; trusting it for filesystem paths is the root of the path-traversal gap identified in the spec (FR-002). `createShelter` (`src/main/db/shelters.ts:113-116`) and the renderer offline fallback (`src/renderer/store/sheltersSlice.ts:63-66`) already contain the same regex inline — extracting it to `src/shared/slug.ts` and calling it from `updateShelter` server-side closes the gap without changing the regex's behavior for existing callers.
**Alternatives considered**: Sanitizing only in the renderer (rejected — per spec FR-002, the renderer value must never be trusted for filesystem paths; an Electron renderer is not a trusted boundary the way a server-side main-process function is).

## Decision: Reject empty-after-sanitization slugs up front

**Rationale**: Per clarification session 2026-06-25, a slug that sanitizes to `''` must be rejected with a clear error before any DB/disk change — consistent with treating sanitization-driven failures the same way as duplicate-slug failures (fail fast, before mutation).
**Alternatives considered**: Falling back to the shelter's ID or re-deriving from its name (both explicitly rejected by the user during clarification in favor of a hard rejection).
