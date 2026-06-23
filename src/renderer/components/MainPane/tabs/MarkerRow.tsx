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

export interface MarkerRowProps {
  m: MapMarker;
  idx: number;
  selected: boolean;
  onRowClick: (id: number, lat: number, lng: number) => void;
  onEdit: (m: MapMarker) => void;
  onDelete: (id: number) => void;
}

export default function MarkerRow({ m, idx, selected, onRowClick, onEdit, onDelete }: MarkerRowProps) {
  return (
    <div
      className={`mm-marker-row${selected ? ' selected' : ''}`}
      data-testid="marker-row"
      onClick={() => onRowClick(m.id, m.latitude, m.longitude)}
    >
      <div className={`mm-pin-num${!m.is_extant ? ' gone' : ''}`}>{idx + 1}</div>
      <div className="mm-row-body">
        <span className="mm-row-name" data-testid="marker-name">{m.name || '(unnamed)'}</span>
        <span className="mm-row-years">
          {m.start_year}–{m.end_year != null ? m.end_year : 'present'}
        </span>
        <span className="mm-row-type">{m.change_type}</span>
      </div>
      <div className="mm-row-coords">
        {m.latitude.toFixed(4)}°N, {Math.abs(m.longitude).toFixed(4)}°W
      </div>
      <div className="mm-row-actions">
        <EditIconButton onClick={(e) => { e.stopPropagation(); onEdit(m); }} />
        <DeleteIconButton onClick={(e) => { e.stopPropagation(); onDelete(m.id); }} />
      </div>
    </div>
  );
}
