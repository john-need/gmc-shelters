import { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AppDispatch, RootState } from '../../../store';
import type { MapMarker, MapMarkerCreateInput, MapMarkerUpdateInput, Shelter } from '../../../../shared/ipc-types';
import { createMarker, updateMarker, deleteMarker, loadMapMarkers } from '../../../store/mapMarkersSlice';
import { setSelectedId as setShelterSelectedId } from '../../../store/sheltersSlice';
import { type FormState, emptyForm, markerToForm, computePreviewEndYear } from './markerUtils';
import { makeNumberedIcon, makeEditingIcon, makeDraftIcon, fitMapToBounds, renderOtherShelterPins } from './markerIcons';
import MarkerDetailPanel from './MarkerDetailPanel';
import MarkerFormPanel from './MarkerFormPanel';
import MarkerRow from './MarkerRow';
import MarkerMapPane from './MarkerMapPane';

const EMPTY_MARKERS: MapMarker[] = [];

interface Props {
  shelterId: number;
  shelter: Shelter;
}

export default function MapMarkersTab({ shelterId, shelter }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const rawMarkers = useSelector((state: RootState) => state.mapMarkers.byShelter[shelterId] ?? EMPTY_MARKERS);
  const allMarkersByShelter = useSelector((state: RootState) => state.mapMarkers.byShelter);
  const allShelters = useSelector((state: RootState) => state.shelters.list);
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
  const [showAll, setShowAll] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pinLayerRef = useRef<Map<number, L.Marker>>(new Map());
  const draftPinRef = useRef<L.Marker | null>(null);
  const otherPinLayerRef = useRef<L.Marker[]>([]);
  const loadedShelterIdsRef = useRef<Set<number>>(new Set());
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
        setForm((f) => ({ ...f, latitude: e.latlng.lat.toFixed(6), longitude: e.latlng.lng.toFixed(6) }));
      }
    });
    map.on('mousemove', (e: L.LeafletMouseEvent) => setHoverCoords({ lat: e.latlng.lat, lng: e.latlng.lng }));
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
      if (mode === 'edit' && m.id === editId) return;
      const pin = new L.Marker([m.latitude, m.longitude] as L.LatLngExpression, {
        icon: makeNumberedIcon(idx + 1, m.id === selectedId, m.is_extant),
      }).addTo(map).on('click', () => setSelectedId((cur) => (cur === m.id ? null : m.id)));
      pinLayerRef.current.set(m.id, pin);
    });
  }, [markers, selectedId, mode, editId]);

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
    if ((mode === 'add' || mode === 'edit') && !isNaN(lat) && !isNaN(lng)) {
      const editIdx = mode === 'edit' ? markers.findIndex((m) => m.id === editId) : -1;
      const icon = mode === 'edit' ? makeEditingIcon(editIdx + 1) : makeDraftIcon();
      draftPinRef.current = new L.Marker([lat, lng] as L.LatLngExpression, { icon, draggable: true })
        .addTo(map)
        .on('dragend', function (this: L.Marker) {
          const pos = this.getLatLng();
          setForm((f) => ({ ...f, latitude: pos.lat.toFixed(6), longitude: pos.lng.toFixed(6) }));
        });
    }
  }, [mode, form.latitude, form.longitude, editId, markers]);

  // ── map cursor ────────────────────────────────────────────────────────────
  useEffect(() => {
    const container = mapRef.current?.getContainer();
    if (container) container.style.cursor = (mode === 'add' || mode === 'edit') ? 'crosshair' : '';
  }, [mode]);

  // ── load other shelters when showAll is on ────────────────────────────────
  useEffect(() => {
    if (!showAll) return;
    allShelters.forEach((s) => {
      if (s.id !== shelterId && !loadedShelterIdsRef.current.has(s.id)) {
        loadedShelterIdsRef.current.add(s.id);
        dispatch(loadMapMarkers(s.id));
      }
    });
  }, [showAll, allShelters, shelterId, dispatch]);

  // ── render other-shelter pins ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    otherPinLayerRef.current.forEach((p) => p.remove());
    otherPinLayerRef.current = showAll
      ? renderOtherShelterPins(map, allMarkersByShelter, allShelters, shelterId, modeRef, (id) => dispatch(setShelterSelectedId(id)))
      : [];
  }, [showAll, allMarkersByShelter, allShelters, shelterId, dispatch]);

  // ── actions ───────────────────────────────────────────────────────────────
  function startAdd() {
    const defaultYear = markers.length === 0 ? shelter.start_year : markers[markers.length - 1].start_year + 1;
    setForm({ ...emptyForm(), start_year: String(defaultYear) });
    setEditId(null); setSelectedId(null); setMode('add'); setErrorMsg(null);
  }

  function startEdit(m: MapMarker) {
    setForm(markerToForm(m)); setEditId(m.id); setSelectedId(m.id); setMode('edit'); setErrorMsg(null);
  }

  function cancelForm() {
    setMode('idle'); setEditId(null); setForm(emptyForm()); setErrorMsg(null);
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true); setErrorMsg(null);
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

  function handleRowClick(id: number, lat: number, lng: number) {
    const isSelecting = selectedId !== id;
    setSelectedId((cur) => (cur === id ? null : id));
    if (isSelecting && mapRef.current) {
      mapRef.current.flyTo([lat, lng] as L.LatLngExpression, Math.max(mapRef.current.getZoom() ?? 15, 15));
    }
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
      <div className="mm-list-pane">
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

        <div className="mm-list-scroll">
          {markers.length === 0 && mode === 'idle' && (
            <div className="mm-empty">
              <div className="mm-empty-label">No map markers recorded.</div>
              <div className="mm-empty-hint">Click &ldquo;Add marker&rdquo; then click the map to place the first location.</div>
            </div>
          )}
          {markers.map((m, idx) => (
            <MarkerRow
              key={m.id}
              m={m}
              idx={idx}
              selected={m.id === selectedId}
              onRowClick={handleRowClick}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>

        {mode === 'idle' ? (
          <MarkerDetailPanel
            selectedMarker={selectedMarker}
            selectedIndex={selectedIndex}
            onEdit={startEdit}
            onDelete={handleDelete}
          />
        ) : (
          <MarkerFormPanel
            mode={mode}
            editingMarker={editingMarker}
            form={form}
            setForm={setForm}
            errorMsg={errorMsg}
            endYearDisplay={endYearDisplay}
            canSave={canSave}
            saving={saving}
            shelterStartYear={shelter.start_year}
            shelterEndYear={shelter.end_year}
            onSave={handleSave}
          />
        )}
      </div>

      <MarkerMapPane
        mode={mode}
        hasLatLng={!!form.latitude}
        showAll={showAll}
        hoverCoords={hoverCoords}
        mapContainerRef={mapContainerRef}
        onToggleShowAll={() => setShowAll((v) => !v)}
      />
    </div>
  );
}
