# Quickstart: Research Tab Web Search Citations

## Prerequisites

- An Anthropic API key and model preference already saved via **Settings → AI Settings** (spec 015). If none is saved, "Search Web" will show a message pointing you there instead of making a call.
- No new environment variables, migrations, or dependencies to install — this feature adds no npm/pip packages.

## Try it

1. Open a shelter, go to the **Research** tab.
2. Type a search term in the existing archive search box (e.g. a shelter or place name).
3. Check **Search web**.
4. Click **Search Web**. The button disables and a loading indicator appears in a new **Web Sources** section, below the existing archive results — the archive results are untouched and still interactive.
5. When it resolves, the Web Sources section shows Claude's primary sources (title + link + snippet), with a small thumbnail on any result where a photo was found.
6. Click **Add Citation** on a result → it opens the same citation editor archive results use, pre-filled (type "Website", title, URL, today's access date, the snippet as the quote). Save it.
7. Switch to the **Sources** tab — the new citation is there, indistinguishable from one added via an archive result.

## Edge cases to check manually

- Uncheck "Search web" — the Web Sources section disappears immediately; archive results are unaffected.
- Click "Search Web" again quickly — the button is disabled while the first request is in flight; a second click before it resolves is a no-op.
- Temporarily clear the saved API key in AI Settings, then try "Search Web" — see the "no key configured" message, no network call, no charge.
- Search a query unlikely to return sources (e.g. gibberish) — see the distinct "no web results" empty state, not the archive search's "no results" message.

## Operator notes

- Every "Search Web" click is one billed Anthropic API call (capped at `max_uses: 3` internal search calls per click) using whichever model is selected in AI Settings.
- Cached thumbnail images live under the app's user-data directory (`research-thumbnails/`) and are never cleaned up automatically — comparable to the existing photo-thumbnail cache.
