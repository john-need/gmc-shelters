import { useState, useEffect, useRef, useCallback } from 'react';
import type { Photo, FileMetadataTag } from '../../../../shared/ipc-types';

export interface PhotoMetadataDialogProps {
  photo: Photo;
  shelterId: number;
  slug: string;
  sheltersRoot: string;
  onClose: () => void;
}

const FOCUSABLE_SEL = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

type TagsByGroup = { group: string; tags: FileMetadataTag[] }[];

const CANONICAL_GROUPS = ['File', 'GPS', 'EXIF', 'Composite', 'XMP'];

function groupOrder(name: string): number {
  const idx = CANONICAL_GROUPS.indexOf(name);
  return idx === -1 ? CANONICAL_GROUPS.length : idx;
}

function groupTags(tags: FileMetadataTag[]): TagsByGroup {
  const map = new Map<string, FileMetadataTag[]>();
  for (const g of CANONICAL_GROUPS) map.set(g, []);
  for (const tag of tags) {
    const list = map.get(tag.group) ?? [];
    list.push(tag);
    map.set(tag.group, list);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => {
      const diff = groupOrder(a) - groupOrder(b);
      return diff !== 0 ? diff : a.localeCompare(b);
    })
    .map(([group, tags]) => ({ group, tags }));
}

export default function PhotoMetadataDialog({ photo, shelterId: _shelterId, slug, sheltersRoot, onClose }: PhotoMetadataDialogProps) {
  const [tags, setTags] = useState<FileMetadataTag[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const loadTags = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    window.api.photos.readFileMetadata(slug, photo.file_name, sheltersRoot)
      .then((result) => {
        setTags(result);
        const initialDraft: Record<string, string> = {};
        for (const t of result) initialDraft[t.key] = t.value ?? '';
        setDraft(initialDraft);
        setLoading(false);
      })
      .catch((err) => {
        setLoadError(err?.message ?? 'Failed to read metadata');
        setLoading(false);
      });
  }, [slug, photo.file_name, sheltersRoot]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleCopy = (key: string, value: string | null) => {
    navigator.clipboard.writeText(value ?? '').then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1500);
    }).catch(() => {});
  };

  const handleSave = async () => {
    if (!tags) return;
    setWriteError(null);
    const original: Record<string, string> = {};
    for (const t of tags) original[t.key] = t.value ?? '';
    const changed: Record<string, string> = {};
    for (const [key, val] of Object.entries(draft)) {
      if (val !== (original[key] ?? '')) changed[key] = val;
    }
    try {
      await window.api.photos.writeFileMetadata(slug, photo.file_name, sheltersRoot, changed);
      onClose();
    } catch (err: unknown) {
      setWriteError(err instanceof Error ? err.message : 'Failed to write metadata');
    }
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SEL));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  const grouped = tags ? groupTags(tags) : [];

  return (
    <div
      data-overlay="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Photo metadata"
        ref={dialogRef}
        onKeyDown={handleDialogKeyDown}
        style={{
          background: 'var(--surface)', borderRadius: 8,
          border: '1px solid var(--line-2)',
          padding: '20px 24px', width: 560, maxWidth: '90vw',
          height: '80vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 17 }}>
            Photo Metadata
          </span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {!editMode ? (
              <>
                {tags && (
                  <button className="btn sm ghost" onClick={() => setEditMode(true)}>
                    Edit
                  </button>
                )}
                <button className="btn icon sm" aria-label="Close" onClick={onClose}>✕</button>
              </>
            ) : (
              <>
                <button className="btn sm primary" onClick={handleSave}>Save</button>
                <button className="btn sm ghost" onClick={onClose}>Cancel</button>
              </>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: 32, color: 'var(--ink-3)' }}>
              Loading…
            </div>
          )}

          {loadError && !loading && (
            <div style={{ padding: 16, textAlign: 'center' }}>
              <p style={{ color: 'var(--red, #c00)', marginBottom: 12 }}>{loadError}</p>
              <button className="btn sm ghost" onClick={loadTags}>Retry</button>
            </div>
          )}

          {writeError && (
            <div style={{ padding: '8px 0', color: 'var(--red, #c00)', fontSize: 12 }}>
              {writeError}
            </div>
          )}

          {!loading && !loadError && grouped.map(({ group, tags: groupTags }) => {
            const isEmpty = groupTags.length === 0;
            const expanded = !isEmpty && expandedGroups.has(group);
            const LABEL_STYLE = { fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase' as const, letterSpacing: '0.08em' };
            return (
              <div key={group} style={{ marginBottom: 8 }}>
                {isEmpty ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0' }}>
                    <div style={{ width: 10, flexShrink: 0 }} />
                    <span style={LABEL_STYLE}>{group}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginLeft: 4, fontStyle: 'italic' }}>
                      No data
                    </span>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => toggleGroup(group)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                        background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
                        textAlign: 'left',
                      }}
                    >
                      <svg
                        width="10" height="10" viewBox="0 0 10 10"
                        style={{ flexShrink: 0, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', color: 'var(--ink-3)' }}
                        fill="currentColor"
                      >
                        <path d="M3 2l4 3-4 3V2z"/>
                      </svg>
                      <span style={LABEL_STYLE}>{group}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)', marginLeft: 4 }}>
                        ({groupTags.length})
                      </span>
                    </button>
                    {expanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                        {groupTags.map((tag) => (
                          <div
                            key={tag.key}
                            data-field={tag.key}
                            style={{
                              display: 'flex', alignItems: 'flex-start', gap: 8,
                              padding: '4px 8px', borderRadius: 4,
                              background: 'var(--surface-2)', border: '1px solid var(--line)',
                            }}
                          >
                            <div style={{ flex: '0 0 130px', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-3)', paddingTop: 2, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                              {tag.label}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {editMode && tag.writable ? (
                                <input
                                  className="input"
                                  type="text"
                                  value={draft[tag.key] ?? ''}
                                  onChange={(e) => setDraft((prev) => ({ ...prev, [tag.key]: e.target.value }))}
                                  style={{ width: '100%', fontSize: 12 }}
                                />
                              ) : (
                                <span style={{
                                  fontSize: 12,
                                  color: (tag.value === null || tag.value === '') ? 'var(--ink-4)' : 'var(--ink)',
                                }}>
                                  {tag.value ?? '—'}
                                </span>
                              )}
                            </div>
                            <button
                              title={copiedKey === tag.key ? 'Copied' : 'Copy'}
                              onClick={() => handleCopy(tag.key, tag.value)}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: copiedKey === tag.key ? 'var(--forest, green)' : 'var(--ink-3)',
                                padding: '2px 4px', flexShrink: 0,
                              }}
                            >
                              {copiedKey === tag.key ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6 9 17l-5-5"/>
                                </svg>
                              ) : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
