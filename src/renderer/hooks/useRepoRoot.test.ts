import { renderHook, act } from '@testing-library/react';
import { useRepoRoot } from './useRepoRoot';

afterEach(() => {
  (window as { api: unknown }).api = undefined;
});

describe('useRepoRoot', () => {
  it('returns empty string before the API resolves', () => {
    (window as { api: unknown }).api = {
      app: { getRepoRoot: jest.fn().mockReturnValue(new Promise(() => {})) },
    };
    const { result } = renderHook(() => useRepoRoot());
    expect(result.current).toBe('');
  });

  it('returns the repo root after the API resolves', async () => {
    (window as { api: unknown }).api = {
      app: { getRepoRoot: jest.fn().mockResolvedValue('/my/repo') },
    };
    const { result } = renderHook(() => useRepoRoot());
    await act(async () => {});
    expect(result.current).toBe('/my/repo');
  });

  it('stays empty when window.api is not present', () => {
    (window as { api: unknown }).api = undefined;
    const { result } = renderHook(() => useRepoRoot());
    expect(result.current).toBe('');
  });
});
