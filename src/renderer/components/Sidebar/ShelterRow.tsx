import type { Shelter } from '../../../shared/ipc-types';
import { buildPhotoUrl } from '../../utils/paths';

interface Props {
  shelter: Shelter;
  selected: boolean;
  onSelect: () => void;
  collapsed: boolean;
  repoRoot?: string;
  sheltersRoot?: string;
}

export default function ShelterRow({ shelter: s, selected, onSelect, collapsed, repoRoot = '', sheltersRoot = '' }: Props) {
  const initial = s.name.replace(/^(The |Mount |Old |Lost )/, '').charAt(0);
  const thumbUrl = repoRoot && s.default_photo_file_name
    ? buildPhotoUrl(repoRoot, sheltersRoot, s.default_photo_file_name)
    : '';
  return (
    <div
      className={`shelter-item ${selected ? 'selected' : ''}`}
      onClick={onSelect}
      title={collapsed ? s.name : undefined}
    >
      <div className={`shelter-item-thumb ${s.is_extant ? 'extant' : 'gone'}`}>
        {thumbUrl
          ? <img src={thumbUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : initial
        }
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
