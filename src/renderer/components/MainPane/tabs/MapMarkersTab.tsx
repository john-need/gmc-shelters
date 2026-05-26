import { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppDispatch, RootState } from '../../../store';
import type { MapMarker, MapMarkerCreateInput, MapMarkerUpdateInput, Shelter } from '../../../../shared/ipc-types';
import { CHANGE_TYPES } from '../../../../shared/ipc-types';
import { createMarker, updateMarker, deleteMarker } from '../../../store/mapMarkersSlice';

// ─── helpers ────────────────────────────────────────────────────────────────

function computePreviewEndYear(
  markers: MapMarker[],
  startYear: number,
  shelter: Shelter,
): number | null {
  const next = markers.find((m) => m.start_year > startYear);
  if (next) return next.start_year - 1;
  return shelter.is_extant ? null : shelter.end_year;
}

// ─── types ────────────────────────────────────────────────────────────────

interface FormState {
  name: string;
  latitude: string;
  longitude: string;
  start_year: string;
  changeTypeBase: string;
  notes: string;
}

function emptyForm(): FormState {
  return { name: '', latitude: '', longitude: '', start_year: '', changeTypeBase: 'Original', notes: '' };
}

function markerToForm(m: MapMarker): FormState {
  return {
    name: m.name,
    latitude: String(m.latitude),
    longitude: String(m.longitude),
    start_year: String(m.start_year),
    changeTypeBase: m.change_type,
    notes: m.notes,
  };
}

// ─── constants ────────────────────────────────────────────────────────────

const EMPTY_MARKERS: MapMarker[] = [];

// ─── icon factories ────────────────────────────────────────────────────────

function makeNumberedIcon(num: number, selected: boolean, extant: boolean): L.DivIcon {
  const cls = ['mm-pin', selected ? 'mm-pin--selected' : extant ? '' : 'mm-pin--gone']
    .filter(Boolean).join(' ');
  return new L.DivIcon({ className: '', html: `<div class="${cls}">${num}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

function makeDraftIcon(): L.DivIcon {
  return new L.DivIcon({ className: '', html: `<div class="mm-pin mm-pin--draft">+</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

function makeShelterIcon(): L.DivIcon {
  return new L.DivIcon({ className: 'mm-shelter-pin', iconSize: [14, 14], iconAnchor: [7, 7] });
}

// ─── map viewport ─────────────────────────────────────────────────────────

function fitMapToBounds(map: L.Map, markers: MapMarker[]): void {
  if (markers.length === 0) {
    map.flyTo([44.0, -71.5] as L.LatLngExpression, 8);
    return;
  }
  if (markers.length === 1) {
    map.flyTo([markers[0].latitude, markers[0].longitude] as L.LatLngExpression, 15);
    return;
  }
  const bounds = markers.reduce<L.LatLngBounds>(
    (b, m) => b.extend([m.latitude, m.longitude] as L.LatLngExpression),
    new L.LatLngBounds(
      [markers[0].latitude, markers[0].longitude] as L.LatLngExpression,
      [markers[0].latitude, markers[0].longitude] as L.LatLngExpression,
    ),
  );
  map.flyToBounds(bounds, { maxZoom: 15, padding: [30, 30] as unknown as L.PointExpression });
}

// ─── component ────────────────────────────────────────────────────────────

interface Props {
  shelterId: number;
  shelter: Shelter;
}

export default function MapMarkersTab({ shelterId, shelter }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const rawMarkers = useSelector((state: RootState) => state.mapMarkers.byShelter[shelterId] ?? EMPTY_MARKERS);
  const markers = useMemo(
    () => [...rawMarkers].sort((a, b) => a.start_year - b.start_year),
    [rawMarkers],
  );

  const [mode, setMode] = useState<'idle' | 'add' | 'edit'>('idle');
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayerRef = useRef<Map<number, L.Marker>>(new Map());
  const draftPinRef = useRef<L.Marker | null>(null);
  const modeRef = useRef<'idle' | 'add' | 'edit'>('idle');

  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── init map ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new L.Map(mapContainerRef.current, { center: [44.0, -71.5], zoom: 13 });

    new L.TileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (modeRef.current === 'add' || modeRef.current === 'edit') {
        setForm((f) => ({
          ...f,
          latitude: e.latlng.lat.toFixed(6),
          longitude: e.latlng.lng.toFixed(6),
        }));
      }
    });

    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setHoverCoords({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    map.on('mouseout', () => setHoverCoords(null));

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── sync marker pins ──────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    pinLayerRef.current.forEach((pin) => pin.remove());
    pinLayerRef.current.clear();

    markers.forEach((m, idx) => {
      const pin = new L.Marker([m.latitude, m.longitude] as L.LatLngExpression, {
        icon: makeNumberedIcon(idx + 1, m.id === selectedId, m.is_extant),
      }).addTo(map).on('click', () => {
        setSelectedId((cur) => (cur === m.id ? null : m.id));
      });
      pinLayerRef.current.set(m.id, pin);
    });
  }, [markers, selectedId]);

  // ── fit map to markers ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    fitMapToBounds(map, markers);
  }, [markers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── draft pin ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (draftPinRef.current) { draftPinRef.current.remove(); draftPinRef.current = null; }

    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (mode === 'add' && !isNaN(lat) && !isNaN(lng)) {
      draftPinRef.current = new L.Marker([lat, lng] as L.LatLngExpression, { icon: makeDraftIcon(), draggable: true })
        .addTo(map)
        .on('dragend', function (this: L.Marker) {
          const pos = this.getLatLng();
          setForm((f) => ({ ...f, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
        });
    }
  }, [mode, form.latitude, form.longitude]);

  // ── map cursor ────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mapRef.current?.getContainer();
    if (container) container.style.cursor = (mode === 'add' || mode === 'edit') ? 'crosshair' : '';
  }, [mode]);

  // ── actions ───────────────────────────────────────────────────────────────
  function startAdd() {
    const defaultYear = markers.length === 0
      ? shelter.start_year
      : markers[markers.length - 1].start_year + 1;
    setForm({ ...emptyForm(), start_year: String(defaultYear) });
    setEditId(null);
    setSelectedId(null);
    setMode('add');
    setErrorMsg(null);
  }

  function startEdit(m: MapMarker) {
    setForm(markerToForm(m));
    setEditId(m.id);
    setSelectedId(m.id);
    setMode('edit');
    setErrorMsg(null);
  }

  function cancelForm() {
    setMode('idle');
    setEditId(null);
    setForm(emptyForm());
    setErrorMsg(null);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      if (mode === 'edit' && editId != null) {
        const input: MapMarkerUpdateInput = {
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          name: form.name,
          change_type: form.changeTypeBase as MapMarker['change_type'],
          notes: form.notes,
        };
        await dispatch(updateMarker({ id: editId, shelterId, input })).unwrap();
      } else {
        const input: MapMarkerCreateInput = {
          shelter_id: shelterId,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          name: form.name,
          start_year: parseInt(form.start_year, 10),
          change_type: form.changeTypeBase as MapMarker['change_type'],
          notes: form.notes,
        };
        await dispatch(createMarker(input)).unwrap();
      }
      cancelForm();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(markerId: number) {
    await dispatch(deleteMarker({ id: markerId, shelterId }));
    if (selectedId === markerId) setSelectedId(null);
    if (editId === markerId) cancelForm();
  }

  // ── derived ───────────────────────────────────────────────────────────────
  const selectedMarker = selectedId != null ? markers.find((m) => m.id === selectedId) : undefined;
  const selectedIndex = selectedMarker ? markers.indexOf(selectedMarker) : -1;

  const canSave = form.latitude.trim() !== '' && form.longitude.trim() !== '';
  const editingMarker = editId != null ? markers.find((m) => m.id === editId) : undefined;
  const previewEndYear = mode === 'add' && form.start_year.trim() !== ''
    ? computePreviewEndYear(markers, parseInt(form.start_year, 10), shelter)
    : (editingMarker?.end_year ?? null);
  const endYearDisplay = mode === 'add'
    ? (form.start_year.trim() ? (previewEndYear != null ? String(previewEndYear) : 'present') : '—')
    : (editingMarker ? (editingMarker.end_year != null ? String(editingMarker.end_year) : 'present') : '—');

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="mm-wrap">

      {/* ── LEFT PANE ─────────────────────────────────────────────────────── */}
      <div className="mm-list-pane">

        {/* header */}
        <div className="mm-list-head">
          <span className="mm-list-title">
            Markers
            {markers.length > 0 && <span className="count">{markers.length}</span>}
          </span>
          {mode === 'idle' ? (
            <button className="btn sm" onClick={startAdd}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              {' '}Add marker
            </button>
          ) : (
            <button className="btn sm ghost" onClick={cancelForm}>Cancel</button>
          )}
        </div>

        {/* list */}
        <div className="mm-list-scroll">
          {markers.length === 0 && mode === 'idle' && (
            <div className="mm-empty">
              <div className="mm-empty-label">No map markers recorded.</div>
              <div className="mm-empty-hint">Click "Add marker" then click the map to place the first location.</div>
            </div>
          )}

          {markers.map((m, idx) => {
            return (
              <div
                key={m.id}
                className={`mm-marker-row${m.id === selectedId ? ' selected' : ''}`}
                data-testid="marker-row"
                onClick={() => {
                  const isSelecting = selectedId !== m.id;
                  setSelectedId((cur) => (cur === m.id ? null : m.id));
                  if (isSelecting && mapRef.current) {
                    mapRef.current.flyTo(
                      [m.latitude, m.longitude] as L.LatLngExpression,
                      Math.max(mapRef.current.getZoom() ?? 15, 15),
                    );
                  }
                }}
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
                  <button
                    className="btn sm ghost icon"
                    aria-label="Edit"
                    title="Edit"
                    onClick={(e) => { e.stopPropagation(); startEdit(m); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    className="btn sm ghost icon"
                    aria-label="Delete"
                    title="Delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(m.id); }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6M14 11v6"/>
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* read-only detail panel (idle) or add/edit form */}
        {mode === 'idle' ? (
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
                    <button
                      className="btn sm ghost icon"
                      aria-label="Edit"
                      title="Edit"
                      onClick={() => startEdit(selectedMarker)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      className="btn sm ghost icon"
                      aria-label="Delete"
                      title="Delete"
                      onClick={() => handleDelete(selectedMarker.id)}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                        <path d="M10 11v6M14 11v6"/>
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                      </svg>
                    </button>
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
        ) : (
          <div className="mm-detail">
            <div className="mm-detail-head">
              <span className="mm-detail-title">
                {mode === 'add' ? 'New marker' : (editingMarker?.name || 'Edit marker')}
              </span>
              {mode === 'add' && (
                <span className="mm-detail-hint">
                  {form.latitude && form.longitude ? 'Location set' : 'Click map to set location'}
                </span>
              )}
            </div>

            {errorMsg && <div className="mm-error">{errorMsg}</div>}

            <div className="mm-detail-body">
              <div className="mm-field-grid">
                {/* name — full width */}
                <div className="mm-field mm-col2">
                  <label className="mm-label">Name</label>
                  <input
                    className="input"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Original site"
                  />
                </div>

                {/* coordinates */}
                <div className="mm-field">
                  <label className="mm-label" htmlFor="mm-lat">Latitude</label>
                  <input
                    id="mm-lat"
                    aria-label="Latitude"
                    className="input mono"
                    type="number"
                    step="0.000001"
                    value={form.latitude}
                    onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                    placeholder="44.0000"
                  />
                </div>
                <div className="mm-field">
                  <label className="mm-label" htmlFor="mm-lng">Longitude</label>
                  <input
                    id="mm-lng"
                    aria-label="Longitude"
                    className="input mono"
                    type="number"
                    step="0.000001"
                    value={form.longitude}
                    onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                    placeholder="-71.0000"
                  />
                </div>

                {/* years */}
                <div className="mm-field">
                  <label className="mm-label">Start year</label>
                  {mode === 'add' ? (
                    <input
                      className="input mono"
                      type="number"
                      value={form.start_year}
                      onChange={(e) => setForm((f) => ({ ...f, start_year: e.target.value }))}
                      min={shelter.start_year}
                      max={shelter.end_year ?? undefined}
                    />
                  ) : (
                    <input className="input mono" value={form.start_year} disabled title="Start year cannot be changed after creation" />
                  )}
                </div>
                <div className="mm-field">
                  <label className="mm-label">
                    End year
                    <span className="mm-label-hint">auto</span>
                  </label>
                  <input className="input mono" value={endYearDisplay} disabled title="Computed automatically from adjacent markers" />
                </div>

                {/* change type — full width */}
                <div className="mm-field mm-col2">
                  <label className="mm-label" htmlFor="mm-type">Change type</label>
                  <select
                    id="mm-type"
                    aria-label="Change Type"
                    className="select"
                    value={form.changeTypeBase}
                    onChange={(e) => setForm((f) => ({ ...f, changeTypeBase: e.target.value }))}
                  >
                    {CHANGE_TYPES.map((ct) => <option key={ct} value={ct}>{ct}</option>)}
                  </select>
                </div>

                {/* notes — full width */}
                <div className="mm-field mm-col2">
                  <label className="mm-label">Notes</label>
                  <textarea
                    className="textarea"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    rows={2}
                  />
                </div>
              </div>
            </div>

            <div className="mm-detail-foot">
              <button className="btn primary" onClick={handleSave} disabled={!canSave || saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── RIGHT PANE — map ──────────────────────────────────────────────── */}
      <div className="mm-map-pane">
        {mode === 'add' && !form.latitude && (
          <div className="mm-placing-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            Click the map to place this marker
          </div>
        )}
        {hoverCoords && (
          <div className="mm-map-coords">
            {hoverCoords.lat.toFixed(4)}°N,{' '}
            {Math.abs(hoverCoords.lng).toFixed(4)}°W
          </div>
        )}
        <div ref={mapContainerRef} className="mm-map" />
      </div>
    </div>
  );
}
