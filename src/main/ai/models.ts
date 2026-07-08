import type { AiModelTier } from '../../shared/ipc-types';

// Mirrors scripts/lib/llm_client.py's DEFAULT_MODEL/ESCALATION_MODEL — keep in sync if either changes.
export const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';
export const ESCALATION_MODEL = 'claude-sonnet-4-6';

export function resolvePrimaryModel(tier: AiModelTier): string {
  return tier === 'escalation' ? ESCALATION_MODEL : DEFAULT_MODEL;
}
