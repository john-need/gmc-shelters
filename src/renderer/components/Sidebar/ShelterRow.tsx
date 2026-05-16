import type { Shelter } from '../../../shared/ipc-types';

interface Props {
  shelter: Shelter;
  selected: boolean;
  onSelect: () => void;
  collapsed: boolean;
}

export default function ShelterRow({ shelter: s, selected, onSelect, collapsed }: Props) {
  const initial = s.name.replace(/^(The |Mount |Old |Lost )/, '').charAt(0);
  return (
    <div
      className={`shelter-item ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      title={collapsed ? s.name : undefined}
    >
      <div className={`shelter-item-thumb ${s.is_extant ? 'extant' : 'gone'}`}>
        {initial}
      </div>
      <div className="shelter-item-main">
        <div className="shelter-item-name">{s.name}</div>
        <div className="shelter-item-sub">
          {s.start_year}{s.end_year ? `–${s.end_year}` : '–'} · {s.category}
        </div>
      </div>
      <div className="shelter-item-meta">
        #{String(s.id).padStart(3, '0')}
      </div>
    </div>
  );
}
