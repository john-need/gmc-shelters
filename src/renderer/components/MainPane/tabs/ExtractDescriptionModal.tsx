export type ExtractDescriptionStatus = 'running' | 'done' | 'error';

export interface ExtractDescriptionModalProps {
  status: ExtractDescriptionStatus;
  description: string | null;
  errorMessage?: string | null;
  onAccept: () => void;
  onReject: () => void;
}

export default function ExtractDescriptionModal({
  status, description, errorMessage, onAccept, onReject,
}: ExtractDescriptionModalProps) {
  return (
    <div className="modal-bg" onClick={onReject}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Extract description from history"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>
            {status === 'done' ? 'Review extracted description'
              : status === 'error' ? 'Could not extract description'
                : 'Extracting description…'}
          </h2>
        </div>

        <div className="modal-body scroll">
          {status === 'error' && (
            <div role="alert" style={{ color: 'var(--rust)' }}>{errorMessage}</div>
          )}
          {status === 'done' && description !== null && (
            <p style={{ margin: 0, lineHeight: 1.5 }}>{description}</p>
          )}
          {status === 'running' && (
            <div style={{ color: 'var(--ink-3)', fontSize: 13 }}>Generating…</div>
          )}
        </div>

        <div className="modal-foot">
          {status === 'done' ? (
            <>
              <button type="button" className="btn" onClick={onReject}>Reject</button>
              <button type="button" className="btn primary" onClick={onAccept}>Accept</button>
            </>
          ) : (
            <button type="button" className="btn" onClick={onReject}>
              {status === 'error' ? 'Dismiss' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
