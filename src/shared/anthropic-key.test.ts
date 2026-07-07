import { isValidAnthropicKey } from './anthropic-key';

describe('isValidAnthropicKey', () => {
  it('returns false for an empty string', () => {
    expect(isValidAnthropicKey('')).toBe(false);
  });

  it('returns false for a whitespace-only string', () => {
    expect(isValidAnthropicKey('   ')).toBe(false);
  });

  it('returns false for a string missing the sk-ant- prefix', () => {
    expect(isValidAnthropicKey('not-a-key')).toBe(false);
  });

  it('returns true for a valid sk-ant-... value', () => {
    expect(isValidAnthropicKey('sk-ant-test123')).toBe(true);
  });
});
