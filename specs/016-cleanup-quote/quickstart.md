# Quickstart: Clean Up Quote

## Cleaning up a quote

1. Open a shelter's Sources tab.
2. On any source card that has a quote, find the "Clean up quote" icon button in the action row (alongside view/edit/delete).
3. Click it. The button shows a busy state while the request runs.
4. On success, the quote field on the card updates to the corrected text. Nothing else about the source, and no wiki markdown file, changes.
5. On failure, the quote is left exactly as it was and an error toast appears.

## Why the button might be disabled

- Its title reads "Clean up quote (requires AI API key)" when no Anthropic key is configured, or the configured key doesn't match the expected `sk-ant-...` format.
- Go to Settings → AI Settings, add a valid key, and return to the Sources tab — the button enables immediately, no restart needed.
- This is a format check, not a live test of the key against Anthropic. A well-formed but revoked/incorrect key still enables the button; a failed request in that case is reported the same way as any other clean-up failure (quote left unchanged, error toast shown).

## What this does not do

- It never touches the source's other bibliographic fields (title, author, container, etc.), the include-in-history toggle, or the source's wiki markdown file — only the `quote` value.
- It does not change the source's "updated" timestamp shown on the card — that timestamp reflects edits made through the source's edit form, not clean-up runs.
- There is no confirmation dialog before it runs — clicking starts the clean-up immediately.
