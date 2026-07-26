import { renderMarkdown } from '../../../markdown';
import { assembleAcceptedHistory } from '../../../../shared/generate-history';
import type { GenerateHistoryEvent, GenerateHistoryToolName, Source } from '../../../../shared/ipc-types';

export type GenerateHistoryStatus = 'running' | 'done' | 'error';

export interface GenerateHistoryModalProps {
  shelterName: string;
  citations: Source[];
  events: GenerateHistoryEvent[];
  pendingPermission: { requestId: string; tool: 'search_collections' | 'download_document'; input: unknown } | null;
  onRespondPermission: (requestId: string, approved: boolean) => void;
  status: GenerateHistoryStatus;
  narrative: string | null;
  errorMessage?: string | null;
  onAccept: () => void;
  onReject: () => void;
}

function toolLabel(tool: GenerateHistoryToolName): string {
  switch (tool) {
    case 'web_search': return 'Web search';
    case 'web_fetch': return 'Web fetch';
    case 'search_collections': return 'Search collections';
    case 'download_document': return 'Read document page';
    default: return String(tool);
  }
}

function inputSummary(input: unknown): string {
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    if (typeof obj.query === 'string') return `"${obj.query}"`;
    if (typeof obj.resource === 'string') return typeof obj.page === 'number' ? `${obj.resource} p.${obj.page}` : obj.resource;
  }
  return '';
}

function ActivityLine({ event }: { event: GenerateHistoryEvent }) {
  if (event.type === 'permission_request') {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        ⏸ Waiting for permission — {toolLabel(event.tool)} {inputSummary(event.input)}
      </div>
    );
  }
  if (event.type === 'tool_call') {
    return (
      <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        ▸ {toolLabel(event.tool)} {inputSummary(event.input)}
      </div>
    );
  }
  if (event.type === 'tool_result') {
    return (
      <div style={{ fontSize: 12, color: event.ok ? 'var(--ink-3)' : 'var(--rust)' }}>
        {event.ok ? '✓' : '✗'} {toolLabel(event.tool)} — {event.summary}
      </div>
    );
  }
  return null;
}

export default function GenerateHistoryModal({
  shelterName, citations, events, pendingPermission, onRespondPermission,
  status, narrative, errorMessage, onAccept, onReject,
}: GenerateHistoryModalProps) {
  const liveText = events.filter((e) => e.type === 'text').map((e) => e.text).join('\n\n');
  const activity = events.filter((e) => e.type !== 'text');
  const assembled = status === 'done' && narrative !== null
    ? assembleAcceptedHistory(shelterName, narrative, citations)
    : null;

  return (
    <div className="modal-bg" onClick={onReject}>
      <div
        className="modal generate-history-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Generate history"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{status === 'done' ? 'Review generated history' : 'Generating history…'}</h2>
        </div>

        <div className="modal-body scroll">
          {status === 'error' && (
            <div role="alert" style={{ color: 'var(--rust)' }}>{errorMessage}</div>
          )}

          {status === 'done' && assembled !== null && (
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(assembled) }} />
          )}

          {status === 'running' && (
            <>
              {pendingPermission && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: '1px solid var(--line-strong)', borderRadius: 8, background: 'var(--surface-2)',
                }}
                >
                  <span style={{ flex: 1, fontSize: 13 }}>
                    Allow <strong>{toolLabel(pendingPermission.tool)}</strong> {inputSummary(pendingPermission.input)}?
                  </span>
                  <button
                    type="button"
                    className="btn sm"
                    onClick={() => onRespondPermission(pendingPermission.requestId, false)}
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() => onRespondPermission(pendingPermission.requestId, true)}
                  >
                    Allow
                  </button>
                </div>
              )}

              {liveText && (
                <div className="md-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(liveText) }} />
              )}

              {activity.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {activity.map((event, i) => <ActivityLine key={i} event={event} />)}
                </div>
              )}
            </>
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
