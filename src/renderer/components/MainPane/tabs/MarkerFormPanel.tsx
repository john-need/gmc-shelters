import type { MapMarker } from '../../../../shared/ipc-types';
import { CHANGE_TYPES } from '../../../../shared/ipc-types';
import type { FormState } from './markerUtils';

export interface MarkerFormPanelProps {
  mode: 'add' | 'edit';
  editingMarker: MapMarker | undefined;
  form: FormState;
  setForm: React.Dispatch<React.SetStateAction<FormState>>;
  errorMsg: string | null;
  canSave: boolean;
  saving: boolean;
  shelterStartYear: number;
  shelterEndYear: number | null | undefined;
  onSave: () => void;
}

export default function MarkerFormPanel({ mode, editingMarker, form, setForm, errorMsg, canSave, saving, shelterStartYear, shelterEndYear, onSave }: MarkerFormPanelProps) {
  return (
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
          <div className="mm-field mm-col2">
            <label className="mm-label">Name</label>
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Original site"
            />
          </div>

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

          <div className="mm-field">
            <label className="mm-label" htmlFor="mm-start-year">Start year</label>
            <input
              id="mm-start-year"
              aria-label="Start year"
              className="input mono"
              type="number"
              value={form.start_year}
              onChange={(e) => setForm((f) => ({ ...f, start_year: e.target.value }))}
              min={shelterStartYear}
              max={shelterEndYear ?? undefined}
            />
          </div>
          <div className="mm-field">
            <label className="mm-label" htmlFor="mm-end-year">
              End year
              <span className="mm-label-hint">blank = present</span>
            </label>
            <input
              id="mm-end-year"
              aria-label="End year"
              className="input mono"
              type="number"
              value={form.end_year}
              onChange={(e) => setForm((f) => ({ ...f, end_year: e.target.value }))}
              placeholder="present"
              min={shelterStartYear}
            />
          </div>

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
        <button className="btn primary" onClick={onSave} disabled={!canSave || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
