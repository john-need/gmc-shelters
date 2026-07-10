import { renderMarkdown } from '../../../markdown';
import { assembleAcceptedHistory } from '../../../../shared/generate-history';
import type { Source } from '../../../../shared/ipc-types';

export interface GenerateHistoryModalProps {
  shelterName: string;
  narrative: string;
  citations: Source[];
  onAccept: () => void;
  onReject: () => void;
}

export default function GenerateHistoryModal({
  shelterName, narrative, citations, onAccept, onReject,
}: GenerateHistoryModalProps) {
  const assembled = assembleAcceptedHistory(shelterName, narrative, citations);

  return (
    <div className="modal-bg" onClick={onReject}>
      <div
        className="modal generate-history-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Review generated history"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>Review generated history</h2>
        </div>
        <div className="modal-body scroll">
          <div className="md-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(assembled) }} />
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onReject}>Reject</button>
          <button type="button" className="btn primary" onClick={onAccept}>Accept</button>
        </div>
      </div>
    </div>
  );
}
