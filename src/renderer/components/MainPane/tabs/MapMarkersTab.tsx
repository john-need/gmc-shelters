import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../../store';
import type { MapMarker, MapMarkerInput, ChangeType, DeleteMarkerResult } from '../../../../shared/ipc-types';
import { CHANGE_TYPES } from '../../../../shared/ipc-types';
import { createMarker, updateMarker, deleteMarker } from '../../../store/mapMarkersSlice';

function splitChangeType(raw: string): { base: string; custom: string } {
  if (raw.startsWith('Other: ')) return { base: 'Other', custom: raw.slice(7) };
  return { base: raw, custom: '' };
}

function combineChangeType(base: string, custom: string): ChangeType {
  return base === 'Other' ? (`Other: ${custom}` as ChangeType) : (base as ChangeType);
}

interface MarkerFormState {
  name: string;
  latitude: string;
  longitude: string;
  start_year: string;
  end_year: string;
  changeTypeBase: string;
  changeTypeCustom: string;
  notes: string;
}

function emptyForm(): MarkerFormState {
  return {
    name: '',
    latitude: '',
    longitude: '',
    start_year: '',
    end_year: '',
    changeTypeBase: 'Original',
    changeTypeCustom: '',
    notes: '',
  };
}

function markerToForm(m: MapMarker): MarkerFormState {
  const { base, custom } = splitChangeType(m.change_type);
  return {
    name: m.name,
    latitude: String(m.latitude),
    longitude: String(m.longitude),
    start_year: String(m.start_year),
    end_year: m.end_year != null ? String(m.end_year) : '',
    changeTypeBase: base,
    changeTypeCustom: custom,
    notes: m.notes,
  };
}

function formToInput(form: MarkerFormState, shelterId: number): MapMarkerInput {
  return {
    shelter_id: shelterId,
    latitude: parseFloat(form.latitude),
    longitude: parseFloat(form.longitude),
    name: form.name,
    start_year: parseInt(form.start_year, 10),
    end_year: form.end_year.trim() !== '' ? parseInt(form.end_year, 10) : null,
    change_type: combineChangeType(form.changeTypeBase, form.changeTypeCustom),
    notes: form.notes,
  };
}

interface MarkerFormProps {
  shelterId: number;
  initial?: MarkerFormState;
  editId?: number;
  onDone: () => void;
  onError: (msg: string) => void;
}

function MarkerForm({ shelterId, initial, editId, onDone, onError }: MarkerFormProps) {
  const dispatch = useDispatch<AppDispatch>();
  const [form, setForm] = useState<MarkerFormState>(initial ?? emptyForm());

  const canSave = form.latitude.trim() !== '' && form.longitude.trim() !== '';

  function set(field: keyof MarkerFormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSave() {
    try {
      const input = formToInput(form, shelterId);
      if (editId != null) {
        await dispatch(updateMarker({ id: editId, input })).unwrap();
      } else {
        await dispatch(createMarker(input)).unwrap();
      }
      onDone();
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="marker-form">
      <div className="form-row">
        <label htmlFor="mm-name">Name</label>
        <input id="mm-name" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="form-row">
        <label htmlFor="mm-lat">Latitude</label>
        <input
          id="mm-lat"
          aria-label="Latitude"
          type="number"
          step="0.0001"
          value={form.latitude}
          onChange={(e) => set('latitude', e.target.value)}
        />
      </div>
      <div className="form-row">
        <label htmlFor="mm-lon">Longitude</label>
        <input
          id="mm-lon"
          aria-label="Longitude"
          type="number"
          step="0.0001"
          value={form.longitude}
          onChange={(e) => set('longitude', e.target.value)}
        />
      </div>
      <div className="form-row">
        <label htmlFor="mm-start">Start Year</label>
        <input
          id="mm-start"
          type="number"
          value={form.start_year}
          onChange={(e) => set('start_year', e.target.value)}
        />
      </div>
      <div className="form-row">
        <label htmlFor="mm-end">End Year</label>
        <input
          id="mm-end"
          type="number"
          value={form.end_year}
          onChange={(e) => set('end_year', e.target.value)}
          placeholder="leave blank for present"
        />
      </div>
      <div className="form-row">
        <label htmlFor="mm-type">Change Type</label>
        <select
          id="mm-type"
          aria-label="Change Type"
          value={form.changeTypeBase}
          onChange={(e) => set('changeTypeBase', e.target.value)}
        >
          {CHANGE_TYPES.map((ct) => (
            <option key={ct} value={ct}>{ct}</option>
          ))}
          <option value="Other">Other</option>
        </select>
        {form.changeTypeBase === 'Other' && (
          <input
            placeholder="Describe the change type"
            value={form.changeTypeCustom}
            onChange={(e) => set('changeTypeCustom', e.target.value)}
          />
        )}
      </div>
      <div className="form-row">
        <label htmlFor="mm-notes">Notes</label>
        <textarea
          id="mm-notes"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
      <div className="form-actions">
        <button disabled={!canSave} onClick={handleSave}>Save</button>
        <button onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

interface Props {
  shelterId: number;
}

export default function MapMarkersTab({ shelterId }: Props) {
  const dispatch = useDispatch<AppDispatch>();
  const markers = useSelector((state: RootState) =>
    [...(state.mapMarkers.byShelter[shelterId] ?? [])].sort((a, b) => a.start_year - b.start_year),
  );

  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gapWarning, setGapWarning] = useState<{ markerId: number; text: string } | null>(null);

  function startEdit(marker: MapMarker) {
    setEditingId(marker.id);
    setMode('edit');
    setErrorMsg(null);
  }

  function returnToList() {
    setMode('list');
    setEditingId(null);
    setErrorMsg(null);
  }

  async function handleDelete(markerId: number) {
    const result = await dispatch(deleteMarker({ id: markerId, shelterId }));
    const payload = result.payload as ReturnType<typeof deleteMarker['fulfilled']['match']> | undefined;
    if (payload && typeof payload === 'object' && 'gapWarning' in payload && (payload as any).gapWarning) {
      const dr = payload as unknown as DeleteMarkerResult;
      setGapWarning({ markerId, text: dr.uncoveredRange });
    }
  }

  async function confirmDelete() {
    if (!gapWarning) return;
    await dispatch(deleteMarker({ id: gapWarning.markerId, shelterId, opts: { confirmed: true } }));
    setGapWarning(null);
  }

  const editingMarker = editingId != null ? markers.find((m) => m.id === editingId) : undefined;

  if (mode === 'add') {
    return (
      <div className="markers-tab">
        <h3>Add Map Marker</h3>
        {errorMsg && <div className="error-msg">{errorMsg}</div>}
        <MarkerForm
          shelterId={shelterId}
          onDone={returnToList}
          onError={setErrorMsg}
        />
      </div>
    );
  }

  if (mode === 'edit' && editingMarker) {
    return (
      <div className="markers-tab">
        <h3>Edit Map Marker</h3>
        {errorMsg && <div className="error-msg">{errorMsg}</div>}
        <MarkerForm
          shelterId={shelterId}
          initial={markerToForm(editingMarker)}
          editId={editingMarker.id}
          onDone={returnToList}
          onError={setErrorMsg}
        />
      </div>
    );
  }

  return (
    <div className="markers-tab">
      {gapWarning && (
        <div className="gap-warning-dialog" role="dialog">
          <p>Deleting this marker would leave a coverage gap:</p>
          <p><strong>{gapWarning.text}</strong></p>
          <button onClick={confirmDelete}>Confirm Delete</button>
          <button onClick={() => setGapWarning(null)}>Cancel</button>
        </div>
      )}

      <div className="markers-actions">
        <button onClick={() => { setMode('add'); setErrorMsg(null); }}>Add Marker</button>
      </div>

      {markers.length === 0 ? (
        <div className="markers-empty">
          <p>No map markers recorded.</p>
        </div>
      ) : (
        <ul className="markers-list">
          {markers.map((m) => {
            const { base, custom } = splitChangeType(m.change_type);
            const changeLabel = base === 'Other' ? `Other: ${custom}` : base;
            return (
              <li key={m.id} className="marker-row" data-testid="marker-row">
                <div className="marker-main">
                  <span className="marker-name" data-testid="marker-name">{m.name}</span>
                  <span className="marker-years">
                    {m.start_year}–{m.end_year != null ? m.end_year : 'present'}
                  </span>
                  <span className="marker-type">{changeLabel}</span>
                </div>
                <div className="marker-coords">
                  {m.latitude.toFixed(4)}°N, {Math.abs(m.longitude).toFixed(4)}°W
                </div>
                {m.notes && <div className="marker-notes">{m.notes}</div>}
                <div className="marker-actions">
                  <button onClick={() => startEdit(m)}>Edit</button>
                  <button onClick={() => handleDelete(m.id)}>Delete</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
