# Replace Sources links a citation to a collections document only on a unique match

"Replace Sources" tries to link each parsed citation to its primary-source PDF in
collections (via `archive_location`, which drives the Sources tab's View PDF button).
`pickWikiResource` (`src/shared/wiki-resource-match.ts`) walks a specificity ladder —
issue-level tokens (month/season name, ordinal edition, volume number) before bare
year — and links **only when exactly one document survives the most specific
applicable level**. Ambiguity means no link: "Long Trail News, 1963" with four 1963
issues stays unlinked, as does "Smoke & Blazes Vol. 58" when three V58 issues exist.

**Why:** a wrong primary-source link silently misattributes the citation, which is
worse for an archival database than an absent one. The toast reports the linked count
("13 added, 10 linked") so unlinked citations are visible, and any source can be
linked by hand afterward. The matcher tolerates the index's field quirks (newsletters
store the year in `volume` and the month/season in `edition`; guide books store an
ordinal number in `edition`; volume-numbered periodicals carry `printed_volume`).
