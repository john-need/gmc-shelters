import React from 'react';

export interface ConfirmDialogProps {
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Non-blocking replacement for window.confirm(). The native confirm() blocks the
// main thread for as long as the dialog is open, which Chromium flags as a
// multi-second "click handler took …ms" violation.
export default function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
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
      <div style={dialogStyle} role="dialog" aria-modal="true" aria-label="Confirm">
        <p style={{ margin: 0, marginBottom: 20, color: 'var(--ink)', lineHeight: 1.5 }}>{message}</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={onCancel}>Cancel</button>
          <button className="btn danger" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
