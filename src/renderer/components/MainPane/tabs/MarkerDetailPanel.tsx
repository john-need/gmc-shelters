import type { MapMarker } from '../../../../shared/ipc-types';

function EditIconButton({ onClick }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button className="btn sm ghost icon" aria-label="Edit" title="Edit" onClick={onClick}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
    </button>
  );
}

function DeleteIconButton({ onClick }: { onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button className="btn sm ghost icon" aria-label="Delete" title="Delete" onClick={onClick}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        <path d="M10 11v6M14 11v6"/>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
      </svg>
    </button>
  );
}

export interface MarkerDetailPanelProps {
  selectedMarker: MapMarker | undefined;
  selectedIndex: number;
  onEdit: (m: MapMarker) => void;
  onDelete: (id: number) => void;
}

export default function MarkerDetailPanel({ selectedMarker, selectedIndex, onEdit, onDelete }: MarkerDetailPanelProps) {
  return (
    <div className={`markers-detail${!selectedMarker ? ' empty' : ''}`}>
      {!selectedMarker ? (
        'Select a marker to view details'
      ) : (
        <>
          <div className="markers-detail-head">
            <div className="markers-detail-name-block">
              <span className="markers-detail-name">{selectedMarker.name || '(unnamed)'}</span>
              <span className="markers-detail-id">
                #{selectedIndex + 1} · {selectedMarker.start_year}–{selectedMarker.end_year != null ? selectedMarker.end_year : 'PRESENT'} · {selectedMarker.change_type.toUpperCase()}
              </span>
            </div>
            <div className="markers-detail-actions">
              <EditIconButton onClick={() => onEdit(selectedMarker)} />
              <DeleteIconButton onClick={() => onDelete(selectedMarker.id)} />
            </div>
          </div>
          <div className="markers-detail-fields">
            <div className="markers-detail-field">
              <span className="markers-detail-field-label">Latitude</span>
              <span className="markers-detail-field-value">{selectedMarker.latitude.toFixed(6)}</span>
            </div>
            <div className="markers-detail-field">
              <span className="markers-detail-field-label">Longitude</span>
              <span className="markers-detail-field-value">{selectedMarker.longitude.toFixed(6)}</span>
            </div>
            <div className="markers-detail-field">
              <span className="markers-detail-field-label">Start year</span>
              <span className="markers-detail-field-value">{selectedMarker.start_year}</span>
            </div>
            <div className="markers-detail-field">
              <span className="markers-detail-field-label">End year</span>
              <span className="markers-detail-field-value">{selectedMarker.end_year != null ? selectedMarker.end_year : 'present'}</span>
            </div>
            <div className="markers-detail-field span4">
              <span className="markers-detail-field-label">Change type</span>
              <span className="markers-detail-field-value">{selectedMarker.change_type}</span>
            </div>
            {selectedMarker.notes && (
              <div className="markers-detail-field span4">
                <span className="markers-detail-field-label">Notes</span>
                <span className="markers-detail-field-value display">{selectedMarker.notes}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
