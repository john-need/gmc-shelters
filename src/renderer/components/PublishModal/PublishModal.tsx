import type { PublishDiff, PublishProgress, PublishResult } from '@shared/ipc-types';

export type PublishPhase = 'loading' | 'review' | 'publishing' | 'done' | 'error';

interface Props {
  phase: PublishPhase;
  diff: PublishDiff | null;
  onCancel: () => void;
  onPublish: () => void;
  progress: PublishProgress | null;
  result: PublishResult | null;
  error: string | null;
}

function preflightLabel(p: PublishProgress | null): string {
  if (p?.stage === 'building') return 'Building manifest…';
  if (p?.stage === 'fetching') return 'Fetching current Drive state…';
  return 'Computing diff…';
}

function uploadLabel(p: PublishProgress): string {
  if (p.stage === 'manifest' || p.itemKind === 'manifest') return 'Writing manifest';
  const verb = p.action === 'update' ? 'Updating' : 'Uploading';
  const kind = p.itemKind === 'history' ? 'history' : 'photo';
  const name = p.fileName ? p.fileName.split('/').pop() : '';
  return name ? `${verb} ${kind} · ${name}` : `${verb} ${kind}`;
}

function Row({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '5px 0', borderBottom: '1px solid var(--border, #efefef)' }}>
      <span style={{ fontSize: 12, color: 'var(--ink-3, #888)' }}>{label}</span>
      <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: accent ?? 'var(--ink-1, #111)' }}>{value}</span>
    </div>
  );
}

function LoadingBody({ progress }: { progress: PublishProgress | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '20px 0' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3, #aaa)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ fontSize: 12, color: 'var(--ink-3, #888)' }}>{preflightLabel(progress)}</div>
    </div>
  );
}

function ReviewBody({ diff }: { diff: PublishDiff }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <Row label="New photos" value={diff.newCount} accent={diff.newCount > 0 ? 'var(--ok, #155724)' : undefined} />
      <Row label="Updated photos" value={diff.updatedCount} accent={diff.updatedCount > 0 ? '#856404' : undefined} />
      <Row label="Deleted from Drive" value={diff.deleteCount} accent={diff.deleteCount > 0 ? 'var(--rust, #a04030)' : undefined} />
      <Row label="Unchanged" value={diff.unchangedCount} />
      <div style={{ marginTop: 12 }} />
      <Row label="Shelters" value={diff.shelterCount} />
      <Row label="Map markers" value={diff.markerCount} />
      {diff.historyToUploadCount > 0 && <Row label="History files" value={diff.historyToUploadCount} />}
    </div>
  );
}

function PublishingBody({ progress }: { progress: PublishProgress }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {progress.stage === 'deleting' && (
        <div style={{ fontSize: 12, color: 'var(--ink-3, #888)' }}>
          Removing {progress.deleteCount ?? 0} file{(progress.deleteCount ?? 0) === 1 ? '' : 's'} from Drive…
        </div>
      )}
      {(progress.stage === 'uploading' || progress.stage === 'manifest') && progress.total > 0 && (
        <>
          <div style={{ height: 4, background: 'var(--border, #e0e0e0)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: 'var(--rust, #a04030)', borderRadius: 2, width: `${Math.round((progress.current / progress.total) * 100)}%`, transition: 'width 0.2s' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--ink-2, #555)' }}>{uploadLabel(progress)}</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3, #888)', fontFamily: 'var(--font-mono)' }}>
            {progress.current} / {progress.total} uploaded
          </div>
        </>
      )}
    </div>
  );
}

function DoneBody({ result }: { result: PublishResult }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {result.photosUploaded > 0 && <Row label="Uploaded" value={result.photosUploaded} accent="var(--ok, #155724)" />}
      {result.photosUpdated > 0 && <Row label="Updated" value={result.photosUpdated} accent="#856404" />}
      {result.photosSkipped > 0 && <Row label="Unchanged" value={result.photosSkipped} />}
      {result.photosFailed > 0 && <Row label="Failed" value={result.photosFailed} accent="var(--rust, #a04030)" />}
      {result.photosMissing > 0 && <Row label="Missing locally" value={result.photosMissing} accent="var(--rust, #a04030)" />}
      <Row label="Shelters" value={result.shelterCount} />
      <Row
        label="Manifest"
        value={result.manifestWritten ? '✓ written' : `✗ ${result.manifestError ?? 'failed'}`}
        accent={result.manifestWritten ? 'var(--ok, #155724)' : 'var(--rust, #a04030)'}
      />
    </div>
  );
}

export default function PublishModal({ phase, diff, onCancel, onPublish, progress, result, error }: Props) {
  const phaseSubtitle = {
    loading: 'Computing diff…',
    review: 'Review changes before publishing',
    publishing: 'Uploading to Google Drive…',
    done: 'Published successfully',
    error: 'Publish failed',
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
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink-1, #111)' }}>Publish to web</div>
          <div style={{ fontSize: 11, color: 'var(--ink-3, #888)', marginTop: 3 }}>{phaseSubtitle}</div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {phase === 'loading' && <LoadingBody progress={progress} />}
          {phase === 'review' && diff && <ReviewBody diff={diff} />}
          {phase === 'publishing' && progress && <PublishingBody progress={progress} />}
          {phase === 'done' && result && <DoneBody result={result} />}
          {phase === 'error' && (
            <div style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--rust, #a04030)', wordBreak: 'break-all' }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border, #e0e0e0)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {(phase === 'loading' || phase === 'review' || phase === 'publishing') && (
            <button className="btn" onClick={onCancel}>Cancel</button>
          )}
          {phase === 'review' && (
            <button className="btn rust" onClick={onPublish}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>
              </svg>
              Publish
            </button>
          )}
          {(phase === 'done' || phase === 'error') && (
            <button className="btn" onClick={onCancel}>Dismiss</button>
          )}
        </div>
      </div>
    </div>
  );
}
