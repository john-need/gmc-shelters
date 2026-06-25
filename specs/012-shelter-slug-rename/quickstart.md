# Quickstart: Verifying Safe Shelter Slug Renames

## Automated tests

```sh
npm test -- src/shared/slug.test.ts
npm test -- src/main/db/shelters.test.ts
npm test -- src/main/fs/photos.test.ts
npm test -- src/main/ipc/shelters.test.ts
npm test -- src/renderer/store/sheltersSlice.test.ts
npm test -- src/renderer/components/MainPane/tabs/ShelterTab.test.tsx
```

## Manual verification (run the app: `npm run dev` or equivalent)

1. **Happy-path rename**: Open a shelter that has at least one photo and a saved history note. Change its Slug field to a new value and save.
   - Expect: save succeeds, the shelter's folder on disk is renamed, the photo still displays in the Photos tab, and the history note still loads in the History view.
   - Verify on disk: the old `{sheltersRoot}/{oldSlug}/` folder no longer exists; `{sheltersRoot}/{newSlug}/` exists with the same `photos/` contents and `{newSlug}.md`.

2. **No-op save**: Edit a different field (e.g., description) on a shelter without touching Slug, and save.
   - Expect: save succeeds; nothing on disk is touched (no rename, no warning logged).

3. **Duplicate rejection**: Create a second shelter, then try to rename the first shelter's slug to exactly match the second shelter's slug.
   - Expect: an in-app error toast appears (`Slug "<value>" is already in use`); neither shelter's DB row nor files changed.

4. **Empty-after-sanitizing rejection**: Set a shelter's Slug field to only symbols/spaces (e.g., `"   "` or `"!!!"`) and save.
   - Expect: an in-app error toast appears; no DB or disk change occurs.

5. **Sanitization**: Set a shelter's Slug field to something with uppercase letters, spaces, and a `/` (e.g., `"My Shelter/Two"`), and save.
   - Expect: the stored and on-disk slug is the sanitized lowercase-hyphenated form (e.g., `my-shelter-two`), with no nested folder created from the `/`.

6. **Stray-folder collision**: Manually create an empty folder at `{sheltersRoot}/some-stray-name/` outside the app, then try to rename a shelter's slug to `some-stray-name`.
   - Expect: an in-app error toast appears (`A folder named "some-stray-name" already exists`); the shelter's slug, files, and the stray folder are all unchanged.
