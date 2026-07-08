import { DEFAULT_MODEL, ESCALATION_MODEL, resolvePrimaryModel } from './models';

describe('ai/models', () => {
  it('resolvePrimaryModel("default") returns DEFAULT_MODEL', () => {
    expect(resolvePrimaryModel('default')).toBe(DEFAULT_MODEL);
  });

  it('resolvePrimaryModel("escalation") returns ESCALATION_MODEL', () => {
    expect(resolvePrimaryModel('escalation')).toBe(ESCALATION_MODEL);
  });

  it('DEFAULT_MODEL/ESCALATION_MODEL match the IDs already wired into scripts/lib/llm_client.py', () => {
    expect(DEFAULT_MODEL).toBe('claude-haiku-4-5-20251001');
    expect(ESCALATION_MODEL).toBe('claude-sonnet-4-6');
  });
});
