# Quickstart: Generate History

## Prerequisites

- An Anthropic API key and model preference already saved via **Settings → AI Settings** (spec 015). If none is saved (or it doesn't match the `sk-ant-` format), "Generate History" appears disabled with the title "Generate History (requires AI API key)".
- No new environment variables, migrations, or dependencies to install — this feature adds no npm/pip packages.

## Try it

1. Open a shelter with some facts filled in on the **Shelter** tab (architecture, built-by, notes, etc.) and at least one citation marked "Cite This" on the **Sources** tab.
2. Go to the **History** tab.
3. Click **Generate History**, positioned after the Source / Both / Preview buttons. The button disables and shows a busy state.
4. When the response arrives, a modal opens showing the full document that would result — a `# {Shelter Name}` heading, Claude's narrative (grounded in the given facts, the included citations, and its own web research), and the current Sources section reattached beneath it — rendered as formatted markdown, not raw source.
5. Click **Accept** — the modal closes and the History tab's editor (in whichever view mode is active) now shows the new content, marked unsaved ("● Modified"). Click **Save file** to persist it, exactly like any manual edit.
6. Try it again and click **Reject** (or dismiss the modal) instead — confirm the History tab's content and saved/dirty indicator are completely unchanged.

## Edge cases to check manually

- Click **Generate History** again quickly — the button is disabled while the first request is in flight; a second click before it resolves is a no-op.
- Temporarily clear the saved API key in AI Settings, then check the History tab — "Generate History" is disabled with the "requires AI API key" title; re-add a valid key and confirm it becomes clickable without restarting the app.
- With unsaved edits already in the History source editor, click Generate History — confirm the draft sent to Claude reflects those in-progress edits, not the last-saved file.
- With no citations marked "Cite This" for the shelter, generate a narrative — confirm it still returns a narrative (using Shelter-tab facts and Claude's own research) and the resulting document has no Sources section.
- Force a failure (e.g., temporarily invalid key, or disconnect network) — confirm the History tab's content is untouched, an error is shown, and no review modal appears.

## Operator notes

- Every "Generate History" click is one billed Anthropic API call (capped at `max_uses: 3` internal web-search calls per click) using whichever model is selected in AI Settings — same cost shape as the Research tab's "Search Web" (spec 018).
- Nothing is written to disk until the user explicitly clicks **Save file** after Accept — Generate History itself never touches the History file on disk.
