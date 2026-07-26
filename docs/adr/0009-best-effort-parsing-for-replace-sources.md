# Best-effort parsing for "Replace Sources", not full per-type reconstruction

`citeChicagoMarkdown()` is a one-way formatter — it renders a `Source` into Chicago-style
prose, and the 10 source types (book, journal, website, map, ...) each use different
punctuation with no field delimiters. Reconstructing every field losslessly per type would
require a near-complete parser for an ad hoc, non-standardized text format, and would still
mis-parse edge cases silently.

`parseHistorySourcesSection()` (`src/shared/history-sources.ts`) instead only extracts what
markdown markup makes structurally unambiguous — author, a quoted/italic title (or
container), a bare 4-digit year, and a trailing `[url](url)` — and guesses `type` from which
markers are present (quote+italic+url → journal-like, italic-only → book-like, quote+url →
website, else `other`). Everything else in the line (publisher, pages, edition, archive
info, ...) is kept verbatim in `annotation` rather than dropped or guessed at.

**Consequence:** "Replace Sources" recreates usable, hand-editable citation stubs, not a
faithful restoration of the original structured fields. Users should expect to touch up
publisher/pages/edition after a replace, not treat it as a lossless round-trip.
