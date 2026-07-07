export function isValidAnthropicKey(key: string): boolean {
  const trimmed = key.trim();
  return trimmed.length > 0 && trimmed.startsWith('sk-ant-');
}
