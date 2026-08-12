import type { ExportProgress, ExportResult } from '@shared/ipc-types';

export type ExportPhase = 'exporting' | 'done' | 'cancelled' | 'error';

interface Props {
  phase: ExportPhase;
  progress: ExportProgress | null;
  result: ExportResult | null;
  error: string | null;
  onCancel: () => void;
}

function stageLabel(p: ExportProgress | null): string {
  if (!p) return 'Starting export…';
  if (p.stage === 'building') return p.shelterName ? `Building · ${p.shelterName}` : 'Building shelters.json…';
  if (p.stage === 'zipping') return 'Compressing archive…';
  return 'Waiting for save location…';
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--border, #efefef)' }}>
      <span style={{ fontSize: 12, color: 'var(--ink-3, #888)' }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: accent ?? 'var(--ink-1, #111)' }}>{value}</span>
    </div>
  );
}

function ExportingBody({ progress }: { progress: ExportProgress | null }) {
  const hasBar = progress?.stage === 'building' && progress.total > 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {hasBar ? (
        <>
          <div style={{ height: 4, background: 'var(--border, #e0e0e0)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--rust, #a04030)', borderRadius: 2, width: `${Math.round((progress!.current / progress!.total) * 100)}%`, transition: 'width 0.2s' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2, #555)' }}>{stageLabel(progress)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3, #888)', fontFamily: 'var(--font-mono)' }}>
            {progress!.current} / {progress!.total} shelters
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3, #aaa)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 12, color: 'var(--ink-3, #888)' }}>{stageLabel(progress)}</div>
        </div>
      )}
    </div>
  );
}

function DoneBody({ result }: { result: ExportResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Row label="Shelters" value={result.shelterCount} />
      <Row label="Photos" value={result.photoCount} />
      {result.skippedPhotos > 0 && <Row label="Skipped (missing files)" value={result.skippedPhotos} accent="var(--rust, #a04030)" />}
      <Row label="Saved to" value={result.savedTo ?? ''} />
    </div>
  );
}

export default function ExportModal({ phase, progress, result, error, onCancel }: Props) {
  const phaseSubtitle = {
    exporting: 'Building the export package…',
    done: 'Export saved successfully',
    cancelled: 'Export cancelled',
    error: 'Export failed',
  }[phase];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />

      <div style={{
        position: 'relative', zIndex: 1, background: 'var(--surface, #fff)',
        borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
        width: 400, maxWidth: '92vw',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'var(--font-sans, system-ui)',
      }}>
        <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--border, #e0e0e0)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1, #111)' }}>Export</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3, #888)', marginTop: 3 }}>{phaseSubtitle}</div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {phase === 'exporting' && <ExportingBody progress={progress} />}
          {phase === 'done' && result && <DoneBody result={result} />}
          {phase === 'cancelled' && (
            <div style={{ fontSize: 12, color: 'var(--ink-3, #888)' }}>The export was cancelled — nothing was saved.</div>
          )}
          {phase === 'error' && (
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--rust, #a04030)', wordBreak: 'break-all' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, #e0e0e0)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {phase === 'exporting' && (
            <button className="btn" onClick={onCancel}>Cancel</button>
          )}
          {(phase === 'done' || phase === 'cancelled' || phase === 'error') && (
            <button className="btn" onClick={onCancel}>Dismiss</button>
          )}
        </div>
      </div>
    </div>
  );
}
