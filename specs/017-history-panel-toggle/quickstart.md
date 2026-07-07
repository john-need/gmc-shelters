# Quickstart: History Panel View Toggle

No operator setup, migration, or configuration is required — this is a renderer-only UI change with no external contract.

## Try it

1. `npm run dev` (or the app's existing dev command) to launch the Electron app.
2. Select any shelter and open its **History** tab.
3. In the toolbar, use the **Source / Both / Preview** toggle:
   - **Source** — hides the preview pane; the editor takes the full width.
   - **Both** — the default; source and preview side-by-side (today's existing layout).
   - **Preview** — hides the source editor; the rendered markdown takes the full width.
4. Type in the editor, switch modes, and confirm your edits and the "Modified"/"Saved" indicator are unaffected by the mode change.
5. Switch to another tab (e.g. Photos) and back, or select a different shelter, and confirm the History tab reopens in the same view mode you last chose.
6. Quit and relaunch the app; confirm the view mode is still remembered.

## Verify

Run the renderer Jest suite:

```bash
npm test -- src/renderer/historyViewSettings.test.ts src/renderer/components/MainPane/tabs/HistoryTab.test.tsx
```
