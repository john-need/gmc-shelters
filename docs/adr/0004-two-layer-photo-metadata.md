# Two-layer photo metadata: file and database are intentionally independent

The metadata dialog reads from and writes to the photo **file** directly (via ExifTool). It does not update the Redux store or the `photos` database table. The right column continues to show database values exclusively. The "Sync from File" button is the only mechanism for propagating file-layer changes into the database — and only when the user explicitly triggers it.

This is deliberate. The file layer is the archival/EXIF record; the database layer is the editorial/publishing record. Keeping them independent means a bulk EXIF correction workflow (e.g., re-dating a set of files) does not silently overwrite operator-curated captions and does not trigger accidental database writes. The explicit "Sync from File" step gives operators control over when and whether file-layer values should become editorial values.

The alternative — having the metadata dialog's save also update the database for the 7 overlapping fields — was rejected because it collapses the two layers into one and removes the distinction between "what is embedded in the file" and "what this application has chosen to publish".
