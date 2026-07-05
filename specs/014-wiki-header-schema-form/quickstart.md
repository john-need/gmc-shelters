# Quickstart: Schema-Driven Wiki Header Editor

## Setting a collection's default citation type

1. Open Settings → Collections Management.
2. Next to a collection's name, use the citation type dropdown to pick the type that best describes its source material (e.g., "GMC Annual Reports" → Report, "Rutland Historical Society Quarterly" → Magazine).
3. This is saved immediately to that collection's `metadata.yaml`. It only affects files added to the wiki **after** this point — files already converted keep whatever citation type they already have until you edit them individually (see below).

## Editing a single file's header

1. In Collections Management, expand a collection and click "Edit header" next to a file that's already been added to the wiki.
2. Each header property appears as its own field — text boxes, dropdowns, or number inputs as appropriate. Read-only fields (file path, conversion date, page count, and the legacy publication-type label) are shown but can't be changed.
3. Changing the "Citation type" dropdown updates which other fields are shown — for example, switching to "Map" hides volume/issue fields that don't apply to maps.
4. Required fields for the current citation type are marked; leaving one blank blocks Save until it's filled in.
5. Click Save. If any value doesn't fit the schema (missing required field, non-numeric issue number, etc.), you'll see exactly what to fix — nothing is written until it's valid.

## What doesn't change

- Adding a PDF to the wiki and the "Clean up" LLM pass work exactly as before.
- Search and citation generation continue reading the same frontmatter fields; this feature only changes how those fields are edited.
