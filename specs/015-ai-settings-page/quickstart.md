# Quickstart: AI Settings Page

## Finding AI configuration

1. Open Settings.
2. Click "AI Settings" in the navigation (a new entry, separate from "Collections").
3. Both the Anthropic API key field and the model dropdown are here.

## Setting the API key

Unchanged from before, just relocated:

1. Enter your key (must start with `sk-ant-`) and click Save.
2. Use Show/Hide to reveal or mask it, or Remove key to clear it.
3. It's stored locally in `.anthropic_api_key` at the repository root — gitignored, owner-readable only. An `ANTHROPIC_API_KEY` environment variable, when set, takes precedence.

## Choosing which model runs AI processing

1. On the AI Settings page, use the "Model" dropdown to pick "Fast (default)" or "Capable (escalation)".
2. The choice saves immediately — no separate Save button for this control.
3. It applies to the next OCR cleanup or photo captioning run; nothing needs to be restarted.
4. If you've never made a choice, or an update ever removes an option you'd picked, the app falls back to "Fast (default)" automatically.

## What changed on the Collections page

- The API key field is no longer there.
- The explanatory note about needing a key is still shown, now with a link to AI Settings so you're never stuck without a way to add one.
- Everything else on Collections (file scanning, clean-up runs, header editing) works exactly as before.
