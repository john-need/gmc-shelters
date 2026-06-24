import React, { useState } from 'react';
import type { Shelter } from '../../../../shared/ipc-types';

export interface MovePhotoDialogProps {
  shelters: Shelter[];
  currentShelterId: number;
  onConfirm: (targetShelterId: number) => void;
  onCancel: () => void;
}

export default function MovePhotoDialog({ shelters, currentShelterId, onConfirm, onCancel }: MovePhotoDialogProps) {
  const [targetShelterId, setTargetShelterId] = useState<number | null>(null);
  const candidates = shelters.filter((s) => s.id !== currentShelterId);

  const overlayStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  };
  const dialogStyle: React.CSSProperties = {
    background: 'var(--surface)', borderRadius: 8,
    border: '1px solid var(--line-2)',
    padding: '24px 28px', minWidth: 360, maxWidth: 440,
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
  };

  return (
    <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-label="Move photo to shelter">
        <p style={{ margin: 0, marginBottom: 12, color: 'var(--ink)', lineHeight: 1.5 }}>Move this photo to:</p>
        <select
          className="select"
          value={targetShelterId ?? ''}
          onChange={(e) => setTargetShelterId(e.target.value ? Number(e.target.value) : null)}
          style={{ width: '100%', marginBottom: 20 }}
        >
          <option value="" disabled>Select a shelter…</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn primary"
            disabled={targetShelterId === null}
            onClick={() => targetShelterId !== null && onConfirm(targetShelterId)}
          >
            Confirm move
          </button>
        </div>
      </div>
    </div>
  );
}
