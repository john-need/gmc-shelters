import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { loadHistory } from '../../store/sheltersSlice';
import { loadPhotos } from '../../store/photosSlice';
import { loadSources } from '../../store/sourcesSlice';
import { loadMapMarkers } from '../../store/mapMarkersSlice';
import { setActiveTab } from '../../store/uiSlice';
import ShelterTab from './tabs/ShelterTab';
import HistoryTab from './tabs/HistoryTab';
import PhotosTab from './tabs/PhotosTab';
import SourcesTab from './tabs/SourcesTab';
import MapMarkersTab from './tabs/MapMarkersTab';

const EMPTY: never[] = [];

export default function MainPane() {
  const dispatch = useDispatch<AppDispatch>();
  const s = useSelector((state: RootState) => state.shelters.editBuffer);
  const selectedId = useSelector((state: RootState) => state.shelters.selectedId);
  const activeTab = useSelector((state: RootState) => state.ui.activeTab);
  const historyContent = useSelector((state: RootState) => state.shelters.historyContent);
  const photos = useSelector((state: RootState) =>
    s ? (state.photos.byShelter[s.id] ?? EMPTY) : EMPTY,
  );
  const sources = useSelector((state: RootState) =>
    s ? (state.sources.byShelter[s.id] ?? EMPTY) : EMPTY,
  );
  const markers = useSelector((state: RootState) =>
    s ? (state.mapMarkers.byShelter[s.id] ?? EMPTY) : EMPTY,
  );

  useEffect(() => {
    if (!s || selectedId === null) return;
    dispatch(loadHistory(s.history ?? `${s.slug}/${s.slug}.md`));
    dispatch(loadPhotos(s.id));
    dispatch(loadSources(s.id));
    dispatch(loadMapMarkers(s.id));
  }, [selectedId]);

  if (!s) {
    return (
      <main className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic',
          fontSize: 18, color: 'var(--ink-3)',
        }}>
          Select a record from the sidebar.
        </div>
      </main>
    );
  }

  const wordCount = (historyContent.match(/\S+/g) || []).length;

  const tabs = [
    {
      id: 'shelter' as const,
      label: 'Shelter',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21h18M5 21V11M19 21V11M5 11l7-7 7 7M9 21v-6h6v6"/>
        </svg>
      ),
      count: null,
    },
    {
      id: 'history' as const,
      label: 'History',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
        </svg>
      ),
      count: `${wordCount} w`,
    },
    {
      id: 'sources' as const,
      label: 'Sources',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 21c3 0 7-1 7-8V5h-7v9h3M14 21c3 0 7-1 7-8V5h-7v9h3"/>
        </svg>
      ),
      count: sources.length,
    },
    {
      id: 'photos' as const,
      label: 'Photos',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>
        </svg>
      ),
      count: photos.length,
    },
    {
      id: 'markers' as const,
      label: 'Map Markers',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>
        </svg>
      ),
      count: markers.length,
    },
  ];

  return (
    <main className="main">
      <div className="main-head">
        <div className="main-title-wrap">
          <div className="main-title">
            {s.name}{' '}
            <em>· {s.start_year ?? '?'}{s.end_year ? ` – ${s.end_year}` : s.is_extant ? ' – Present' : ' – ?'}</em>
          </div>
          <div className="main-sub">
            <span className="id">#{String(s.id).padStart(6, '0')}</span>
            <span className={`badge ${s.is_extant ? 'extant' : 'gone'}`}>
              {s.is_extant ? 'Extant' : 'Lost'}
            </span>
            {s.is_gmc && <span className="badge gmc">GMC</span>}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {markers[0] != null
                ? `${markers[0].latitude.toFixed(4)}°N, ${Math.abs(markers[0].longitude).toFixed(4)}°W`
                : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => dispatch(setActiveTab(t.id))}
          >
            {t.icon} {t.label}
            {t.count != null && <span className="count">{t.count}</span>}
          </button>
        ))}
      </div>

      <div className={`tab-body${activeTab === 'markers' ? ' tab-body--map' : ''}`}>
        {activeTab === 'shelter' && <ShelterTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'sources' && <SourcesTab />}
        {activeTab === 'photos' && <PhotosTab />}
        {activeTab === 'markers' && s && <MapMarkersTab shelterId={s.id} shelter={s} />}
      </div>
    </main>
  );
}
