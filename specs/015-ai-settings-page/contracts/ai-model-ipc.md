# Contract: `AI_GET_MODEL` / `AI_SET_MODEL` (internal IPC)

Internal contract between `src/renderer/components/Settings/AiSettingsPage.tsx` and `src/main/ipc/ai-settings.ts`. No out-of-repo consumer. New channels — no "before" shape exists.

## Shape

```ts
export type AiModelTier = 'default' | 'escalation';

export const AI_MODEL_OPTIONS: { id: AiModelTier; label: string }[] = [
  { id: 'default', label: 'Fast (default)' },
  { id: 'escalation', label: 'Capable (escalation)' },
];

ai.getModel(): Promise<AiModelTier>          // always resolves — never null/undefined
ai.setModel(tier: AiModelTier): Promise<void>
```

## Behavior

- `getModel`: reads `.ai_model` at the repo root (via `app.getAppPath()`, same base path `ai-settings.ts` already uses for `.anthropic_api_key`). Returns the trimmed contents if it is exactly `'default'` or `'escalation'`; returns `'default'` for a missing file, empty file, or any other unrecognized content (FR-008) — never throws, never returns an unrecognized value to the caller.
- `setModel`: validates `tier` is one of the two `AiModelTier` values. On a valid tier, writes it (trimmed, newline-terminated) to `.ai_model` with owner-only permissions (`0o600`, mirroring the API key file). On an invalid value, rejects without writing (defensive — the renderer's `<select>` only ever offers the two valid options, so this path is not reachable through the UI).

## Backward compatibility

None required — brand-new channels with a single caller (`AiSettingsPage.tsx`), introduced in this change set.
