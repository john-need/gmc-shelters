import { useState, useEffect } from 'react';

export function useRepoRoot(): string {
  const [repoRoot, setRepoRoot] = useState('');
  useEffect(() => {
    let cancelled = false;
    if (typeof window === 'undefined' || !window.api) return undefined;
    window.api.app.getRepoRoot()
      .then((root) => { if (!cancelled) setRepoRoot(root); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return repoRoot;
}
