import { useState, memo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Photo } from '../../../../shared/ipc-types';
import { photoBackground } from './PhotoCard';
import IncludeInPostCheckbox from '../../ui/IncludeInPostCheckbox';

export const LIST_ROW_GRID = '40px 1.5fr 1fr 110px 80px 90px';
export const LIST_ROW_PAD = '6px 12px 6px 52px'; // left pad clears the 40px absolute drag handle

const noop = () => {};

export const DragHandleGrip = () => (
  <svg width="8" height="14" viewBox="0 0 8 14" fill="currentColor" aria-hidden="true">
    <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
    <circle cx="2" cy="7" r="1.2" /><circle cx="6" cy="7" r="1.2" />
    <circle cx="2" cy="12" r="1.2" /><circle cx="6" cy="12" r="1.2" />
  </svg>
);

export interface ListRowBodyProps {
  p: Photo;
  idx: number;
  isDefault: boolean;
  onToggleInclude: (id: number, newValue: boolean) => void;
  photoUrl: string;
}

export const ListRowBody = memo(function ListRowBody({ p, idx, isDefault, onToggleInclude, photoUrl }: ListRowBodyProps) {
  const [imgError, setImgError] = useState(false);
  const initial = p.title ? p.title.charAt(0) : p.file_name.charAt(0).toUpperCase();
  return (
    <>
      <div style={{
        width: 26, height: 26, borderRadius: 3,
        background: photoBackground(idx),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 12,
        color: 'rgba(255,247,225,0.7)',
        position: 'relative', overflow: 'hidden',
      }}>
        {photoUrl && !imgError ? (
          <img src={photoUrl} alt="" onError={() => setImgError(true)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : initial}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        {isDefault && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="var(--forest)" stroke="var(--forest)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        )}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title || 'Untitled'}</span>
      </div>
      <span style={{ color: 'var(--ink-2)', fontSize: 12 }}>{p.photographer || '—'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>{p.date_taken || '—'}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--ink-4)' }}>#{p.id}</span>
      <span
        style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IncludeInPostCheckbox photoId={p.id} checked={!!p.include_in_post} onToggle={onToggleInclude} />
      </span>
    </>
  );
});

export interface ListRowProps extends ListRowBodyProps {
  isSelected: boolean;
  onSelect: (id: number) => void;
  onOpenEditor: (id: number) => void;
}

export const ListRow = memo(function ListRow({ p, idx, isDefault, isSelected, onSelect, onOpenEditor, onToggleInclude, photoUrl }: ListRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: p.id });
  return (
    <div
      ref={setNodeRef}
      data-testid={`list-row-${p.id}`}
      onClick={() => onSelect(p.id)}
      onDoubleClick={() => onOpenEditor(p.id)}
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: LIST_ROW_GRID,
        alignItems: 'center',
        padding: LIST_ROW_PAD,
        borderBottom: '1px solid var(--line)',
        background: isSelected ? 'var(--selected)' : 'transparent',
        fontSize: 12.5,
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <span
        className="list-drag-handle"
        aria-label="Drag to reorder"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        <DragHandleGrip />
      </span>
      <ListRowBody p={p} idx={idx} isDefault={isDefault} onToggleInclude={onToggleInclude} photoUrl={photoUrl} />
    </div>
  );
});

export function ListRowOverlay({ p, idx, isDefault, photoUrl }: ListRowBodyProps) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: LIST_ROW_GRID,
        alignItems: 'center',
        padding: LIST_ROW_PAD,
        background: 'var(--surface)',
        fontSize: 12.5,
        outline: '2px solid var(--forest)',
        outlineOffset: -2,
        boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
        cursor: 'grabbing',
      }}
    >
      <span className="list-drag-handle"><DragHandleGrip /></span>
      <ListRowBody p={p} idx={idx} isDefault={isDefault} onToggleInclude={noop} photoUrl={photoUrl} />
    </div>
  );
}
