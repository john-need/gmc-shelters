import { useState, useEffect } from 'react';
import type { AppDispatch } from '../../../store';
import type { UntrackedFile, OrphanedRecord, ReconcileApplyResult } from '../../../../shared/ipc-types';
import { reconcileApply, removePhotoLocal } from '../../../store/photosSlice';
import { setDefaultPhotoLocal } from '../../../store/sheltersSlice';

export interface ReconcileModalProps {
  shelterId: number;
  sheltersRoot: string;
  shelterSlug: string;
  defaultPhotoId: number | null;
  onClose: (applied: boolean) => void;
  dispatch: AppDispatch;
}

export default function ReconcileModal({ shelterId, sheltersRoot, shelterSlug: _slug, defaultPhotoId, onClose, dispatch }: ReconcileModalProps) {
  const [scanning, setScanning] = useState(true);
  const [untrackedFiles, setUntrackedFiles] = useState<UntrackedFile[]>([]);
  const [orphanedRecords, setOrphanedRecords] = useState<OrphanedRecord[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<ReconcileApplyResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const scan = await window.api.photos.reconcileScan(shelterId, sheltersRoot);
        if (!cancelled) {
          setUntrackedFiles(scan.untrackedFiles);
          setOrphanedRecords(scan.orphanedRecords);
        }
      } finally {
        if (!cancelled) setScanning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shelterId, sheltersRoot]);

  const toggleFile = (fileName: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName); else next.add(fileName);
      return next;
    });
  };

  const toggleRecord = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const noneSelected = selectedFiles.size === 0 && selectedIds.size === 0;

  const handleApply = async () => {
    setApplying(true);
    try {
      const action = await dispatch(reconcileApply({
        shelterId,
        sheltersRoot,
        filesToAdd: Array.from(selectedFiles),
        recordIdsToDelete: Array.from(selectedIds),
      }));
      if (reconcileApply.fulfilled.match(action)) {
        const res = action.payload;
        setResult(res);
        selectedIds.forEach((id) => {
          dispatch(removePhotoLocal({ shelterId, photoId: id }));
          if (defaultPhotoId === id) {
            dispatch(setDefaultPhotoLocal({ shelterId, photoId: null, fileName: '' }));
          }
        });
      }
    } finally {
      setApplying(false);
    }
  };

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const dialogStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 8,
    border: '1px solid var(--line-2)',
    padding: '24px 28px', minWidth: 460, maxWidth: 600,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    maxHeight: '80vh', display: 'flex', flexDirection: 'column',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onClose(false); }}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-label="Reconcile Photos">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 18 }}>Reconcile Photos</span>
          <button className="btn icon sm" aria-label="Close" onClick={() => onClose(!!result)}>✕</button>
        </div>

        {scanning ? (
          <p style={{ color: 'var(--ink-2)', fontStyle: 'italic' }}>Scanning…</p>
        ) : result ? (
          <div>
            <p style={{ marginBottom: 12, color: 'var(--ink)' }}>
              {result.added > 0 && <span>{result.added} added</span>}
              {result.added > 0 && (result.deleted > 0 || result.failed > 0) && ' · '}
              {result.deleted > 0 && <span>{result.deleted} deleted</span>}
              {result.failed > 0 && (result.added > 0 || result.deleted > 0) && ' · '}
              {result.failed > 0 && <span style={{ color: 'var(--red, #c0392b)' }}>{result.failed} failed</span>}
            </p>
            {result.failures.length > 0 && (
              <ul style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)', margin: 0, paddingLeft: 16 }}>
                {result.failures.map((f, i) => <li key={i}>{f.item}: {f.reason}</li>)}
              </ul>
            )}
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={() => onClose(true)}>Done</button>
            </div>
          </div>
        ) : (untrackedFiles.length === 0 && orphanedRecords.length === 0) ? (
          <div>
            <p style={{ color: 'var(--ink-2)', fontStyle: 'italic' }}>All photos are in sync</p>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => onClose(false)}>Close</button>
            </div>
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {untrackedFiles.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>
                  Files on disk, not in database ({untrackedFiles.length})
                </p>
                {untrackedFiles.map((f) => {
                  const displayName = f.fileName.split('/').pop() || f.fileName;
                  return (
                    <label key={f.fileName} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                      <input type="checkbox" aria-label={displayName} checked={selectedFiles.has(f.fileName)} onChange={() => toggleFile(f.fileName)} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{displayName}</span>
                    </label>
                  );
                })}
              </section>
            )}
            {orphanedRecords.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-3)', marginBottom: 8 }}>
                  Database records with no file ({orphanedRecords.length})
                </p>
                {orphanedRecords.map((r) => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer' }}>
                    <input type="checkbox" aria-label={r.fileName} checked={selectedIds.has(r.id)} onChange={() => toggleRecord(r.id)} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{r.fileName}</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 11 }}>{r.title}</span>
                  </label>
                ))}
              </section>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <button className="btn ghost" onClick={() => onClose(false)}>Cancel</button>
              <button className="btn primary" disabled={noneSelected || applying} onClick={handleApply}>
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
