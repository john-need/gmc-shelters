# Quickstart: Move Photo To Another Shelter

## Try it manually

1. `npm start` to launch the Electron app.
2. Open a shelter with at least one photo, go to the Photos tab, select a photo so its detail pane shows on the right.
3. Click the new "Move to shelter" icon button in the photo detail header (next to metadata/default/export/delete).
4. Pick a different shelter from the list, then click "Confirm move".
5. Verify: the photo disappears from the current shelter's Photos tab; the underlying file is now under `shelters/<target-slug>/photos/`; opening the target shelter's Photos tab shows the photo there with a working thumbnail.

## Run the tests

```bash
npm test -- src/main/db/photos.test.ts
npm test -- src/main/fs/photos.test.ts
npm test -- src/main/ipc/photos.test.ts
npm test -- src/renderer/components/MainPane/tabs/MovePhotoDialog.test.tsx
npm test -- src/renderer/components/MainPane/tabs/PhotoDetailPane.test.tsx
npm test -- src/renderer/components/MainPane/tabs/PhotosTab.test.tsx
```

Per the TDD approach for this feature, each of these should exist and fail before the corresponding implementation is written, then pass after.

## Operator notes

No operator-facing process changes — this is an in-app desktop feature with no external contract, migration, or rerun/idempotency surface (see Constitution Check in `plan.md`).
