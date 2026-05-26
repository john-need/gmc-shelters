# Operator Guide: Photos Tab Reconcile

**Feature**: `005-photos-reconcile`  
**Applies to**: GMC Shelters desktop app

## When to use Reconcile

Use the Reconcile feature when the photos visible in the app are out of sync with the actual files on your computer. This can happen when:

- You copied image files directly into a shelter's `photos/` folder outside of the app (bulk import, file transfer, etc.)
- Photo files were deleted or moved from disk without using the app's delete action, leaving broken entries in the database

## How to use

1. Open the GMC Shelters app and select the shelter you want to check.
2. Click the **Photos** tab.
3. In the toolbar, click the **Reconcile** button.
4. The app scans the shelter's `photos/` folder and the database. A loading indicator appears briefly.
5. Two sections appear:
   - **Files not in database** — image files found on disk but not yet registered in the app
   - **Records with no file** — database entries whose files are missing from disk
6. Check the boxes next to any items you want to add or remove.
   - Use **Select All** / **Deselect All** to quickly select an entire section.
   - Items you leave unchecked are not touched.
7. Click **Reconcile** to apply your selections.
8. A summary shows how many items were added, deleted, or failed.
9. Click **Close** — the photos list refreshes to reflect the changes.

## What Reconcile does and does not do

| Action | Does Reconcile do this? |
|--------|------------------------|
| Add untracked files to the database | ✅ Yes — for selected files |
| Delete orphaned database records | ✅ Yes — for selected records |
| Delete files from disk | ❌ No — files on disk are never removed by Reconcile |
| Write metadata to files | ❌ No — only database rows are created or deleted |
| Change existing photos or records | ❌ No — only selected new/missing items are affected |

## Notes

- Newly registered photos get their filename (without extension) as the title. Edit the title and other metadata in the main Photos tab after reconciling.
- If the default photo for a shelter is an orphaned record you choose to delete, the default photo designation is automatically cleared. Set a new default in the Photos tab afterwards.
- Running Reconcile is always safe to repeat. If the shelter is already in sync, both lists will be empty.
- Only JPEG, PNG, TIFF, and WEBP files are considered. Other file types in the photos folder are ignored.
