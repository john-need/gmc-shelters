# Quickstart: Photo Thumbnail Caching

This feature is internal to the desktop app — no operator setup, credentials, or external service configuration is required (unlike feature 009's Google Drive publish flow).

## Verifying the fix locally

1. `npm start` to launch the app in development mode.
2. Open a shelter with many (ideally 50+) large photos. If none exists, use the photo upload flow to add several multi-megabyte images to one shelter.
3. **Shelters tab**: confirm the shelter's default photo loads quickly and isn't blurry at its displayed size.
4. **Photos tab — grid view**: drag a photo card to a new position. Confirm the drag tracks the cursor with no visible stutter, and the new order persists after reload.
5. **Photos tab — list view**: repeat the drag test in list view.
6. **Photos tab — selected photo**: click a photo to select it; confirm the inline preview pane loads quickly (using the cached preview thumbnail, not the full original).
7. **Photo editor**: open the editor for the selected photo; confirm the editor loads the true full-resolution image (check via zoom/crop precision, or by inspecting the network/file request in DevTools).
8. **Cache invalidation**: edit/replace a photo's file (e.g. via the editor's save), return to the grid/list/shelter tab, and confirm the displayed thumbnail reflects the updated image, not a stale cached one.

## Where the cache lives

Generated thumbnails are written to `app.getPath('userData')/photo-thumbnails/{grid,preview}/`. To force regeneration of all thumbnails during testing, delete this directory while the app is closed; it will be repopulated on demand.

## Running tests

```bash
npm test
```

Runs the existing two-project Jest config (`src/main`, `src/renderer`), including the new `src/main/fs/thumbnails.test.ts` and the updated component tests for `PhotoCard`, `ListRow`, `ShelterTab`, and `PhotoDetailPane`.
