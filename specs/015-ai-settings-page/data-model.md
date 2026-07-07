# Data Model: AI Settings Page

## Entities

### AI Configuration

The operator's local AI setup for this app. Two independent scalar values, each with its own small storage file at the repository root (gitignored, owner-readable):

| Field | Storage | Format | Precedence |
|---|---|---|---|
| API key | `.anthropic_api_key` (existing) | trimmed plain text, must start with `sk-ant-` if non-empty | `ANTHROPIC_API_KEY` env var overrides the file (existing behavior, unchanged) |
| Model preference | `.ai_model` (new) | trimmed plain text, one of the two tier keys below | none — file only |

Both files are read by the desktop app (via IPC) and by the local Python conversion pipeline (`scripts/lib/llm_client.py`) directly from disk — the same dual-reader pattern the API key file already uses.

### Supported Model (tier)

Exactly two fixed entries — no user-added options, no free text:

| Tier key | Display label | Underlying Python constant |
|---|---|---|
| `default` | "Fast (default)" | `llm_client.DEFAULT_MODEL` (`claude-haiku-4-5-20251001`) |
| `escalation` | "Capable (escalation)" | `llm_client.ESCALATION_MODEL` (`claude-sonnet-4-6`) |

The tier key is the functional value stored/transmitted; the display label is a cosmetic string kept in the shared TypeScript constant (`AI_MODEL_OPTIONS`, see Contracts) and manually kept in sync with `llm_client.py`'s two constants — the same "small stable constant, one-line change if it ever needs updating" precedent as `specs/014-wiki-header-schema-form`'s `HEADER_SCHEMA` table.

## Validation Rules

- Model preference: on write, the value MUST be exactly `'default'` or `'escalation'`; anything else is rejected (IPC handler does not write an unrecognized value).
- Model preference: on read, if the file is missing, empty, or holds an unrecognized value, the system returns `'default'` (FR-008) rather than erroring.
- API key: validation rule unchanged from today (`sk-ant-` prefix required when non-empty; empty is valid and removes the file).

## State / Lifecycle

1. AI Settings page mounts → `ai.getApiKey()` and `ai.getModel()` are both called; the key field and the model `<select>` populate independently (neither blocks the other, per the spec's edge case: a model choice can be made before or after a key exists).
2. Operator changes the `<select>` → `ai.setModel(tier)` is called immediately (no separate Save button, per FR-006/SC-003) and the file is overwritten synchronously.
3. Operator changes/saves the API key → unchanged existing flow (`ai.setApiKey(key)`, explicit Save button, `sk-ant-` validation).
4. Next OCR cleanup or captioning run (`scripts/ocr_to_markdown.py`) → constructs `AnthropicClient` with `primary_model` resolved from `.ai_model` at that moment (read fresh per run, not cached), so a preference change takes effect on the very next run without restarting the app.

No multi-step or asynchronous state machine — each get/set is a single request/response pair, matching the existing `ai.getApiKey`/`ai.setApiKey` shape.
