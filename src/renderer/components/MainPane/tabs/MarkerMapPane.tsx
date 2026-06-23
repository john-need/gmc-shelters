export interface MarkerMapPaneProps {
  mode: 'idle' | 'add' | 'edit';
  hasLatLng: boolean;
  showAll: boolean;
  hoverCoords: { lat: number; lng: number } | null;
  mapContainerRef: React.RefObject<HTMLDivElement>;
  onToggleShowAll: () => void;
}

const LocationIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>
  </svg>
);

export default function MarkerMapPane({ mode, hasLatLng, showAll, hoverCoords, mapContainerRef, onToggleShowAll }: MarkerMapPaneProps) {
  return (
    <div className="mm-map-pane">
      {mode === 'add' && !hasLatLng && (
        <div className="mm-placing-banner">
          <LocationIcon />
          Click the map to place this marker
        </div>
      )}
      {mode === 'edit' && (
        <div className="mm-placing-banner">
          <LocationIcon />
          Click map or drag pin to relocate
        </div>
      )}
      <button
        className={`mm-map-toggle${showAll ? ' active' : ''}`}
        onClick={onToggleShowAll}
        title={showAll ? 'Showing all shelters — click to show current only' : 'Show all shelters'}
      >
        All shelters
      </button>
      {hoverCoords && (
        <div className="mm-map-coords">
          {hoverCoords.lat.toFixed(4)}°N,{' '}
          {Math.abs(hoverCoords.lng).toFixed(4)}°W
        </div>
      )}
      <div ref={mapContainerRef} className="mm-map" />
    </div>
  );
}
