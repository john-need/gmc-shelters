import { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import {
  createArchitecture,
  updateArchitecture,
  deleteArchitecture,
} from '../../store/architecturesSlice';
import { showToast } from '../../store/uiSlice';
import type { Architecture } from '../../../shared/ipc-types';

function SettingsHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="settings-page-head">
      <div>
        <div
          className="settings-page-title"
          dangerouslySetInnerHTML={{ __html: title }}
        />
        <div className="settings-page-sub">§ Settings / Architectures</div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>{children}</div>
    </div>
  );
}

interface EditFormProps {
  initial: Partial<Architecture>;
  onSave: (name: string, description: string) => void;
  onCancel: () => void;
  creating: boolean;
}

function EditForm({ initial, onSave, onCancel, creating }: EditFormProps) {
  const [name, setName] = useState(initial.name ?? '');
  const [description, setDescription] = useState(initial.description ?? '');

  return (
    <div className="arch-edit-form">
      <div className="field">
        <label className="label">Name <span className="req">*</span></label>
        <input
          className="input"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Adirondack lean-to"
        />
      </div>
      <div className="field">
        <label className="label">Description <span className="hint">optional</span></label>
        <textarea
          className="textarea"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this construction type…"
        />
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button
          className="btn primary"
          disabled={!name.trim()}
          onClick={() => onSave(name.trim(), description.trim())}
        >
          {creating ? (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add type
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>
              </svg>
              Save
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface DeleteConfirmProps {
  arch: Architecture;
  others: Architecture[];
  onConfirm: (reassignTo: string) => void;
  onCancel: () => void;
  usageCount: number;
}

function DeleteConfirm({ arch, others, onConfirm, onCancel, usageCount }: DeleteConfirmProps) {
  const [reassignTo, setReassignTo] = useState('');
  const needsReassign = usageCount > 0;

  return (
    <div className="arch-delete-confirm">
      <div className="arch-delete-confirm-msg">
        {needsReassign ? (
          <>
            <strong>{usageCount} shelter{usageCount !== 1 ? 's' : ''}</strong> use &ldquo;{arch.name}&rdquo;.
            Choose a replacement before deleting.
          </>
        ) : (
          <>Delete &ldquo;{arch.name}&rdquo;? This cannot be undone.</>
        )}
      </div>
      {needsReassign && (
        <div className="field" style={{ marginTop: 10 }}>
          <label className="label">Reassign to</label>
          <select className="select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="">— choose —</option>
            {others.map((a) => (
              <option key={a.id} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
        <button className="btn" onClick={onCancel}>Cancel</button>
        <button
          className="btn danger"
          disabled={needsReassign && !reassignTo}
          onClick={() => onConfirm(reassignTo)}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function ArchitecturesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const architectures = useSelector((s: RootState) => s.architectures.list);
  const shelters = useSelector((s: RootState) => s.shelters.list);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Architecture | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Architecture | null>(null);

  const usageByName = useMemo(() => {
    const m: Record<string, number> = {};
    shelters.forEach((s) => {
      if (s.architecture) m[s.architecture] = (m[s.architecture] ?? 0) + 1;
    });
    return m;
  }, [shelters]);

  const filtered = useMemo(() => {
    if (!query) return architectures;
    const q = query.toLowerCase();
    return architectures.filter(
      (a) => a.name.toLowerCase().includes(q) || a.description.toLowerCase().includes(q),
    );
  }, [architectures, query]);

  const handleCreate = (name: string, description: string) => {
    dispatch(createArchitecture({ name, description })).then(() => {
      dispatch(showToast({ id: Date.now().toString(), message: `Added "${name}"` }));
    });
    setCreating(false);
  };

  const handleUpdate = (name: string, description: string) => {
    if (!editing) return;
    dispatch(updateArchitecture({ ...editing, name, description })).then(() => {
      dispatch(showToast({ id: Date.now().toString(), message: `Saved "${name}"` }));
    });
    setEditing(null);
  };

  const handleDelete = (reassignTo: string) => {
    if (!confirmDelete) return;
    dispatch(deleteArchitecture({ id: confirmDelete.id, reassignTo: reassignTo || undefined })).then(() => {
      const msg = reassignTo
        ? `Deleted · ${usageByName[confirmDelete.name] ?? 0} record(s) reassigned to "${reassignTo}"`
        : `Deleted "${confirmDelete.name}"`;
      dispatch(showToast({ id: Date.now().toString(), message: msg }));
    });
    setConfirmDelete(null);
  };

  return (
    <>
      <SettingsHead title="Architectures <em>· construction types</em>">
        <button
          className="btn primary"
          onClick={() => { setCreating(true); setEditing(null); }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
          New type
        </button>
      </SettingsHead>

      <div className="settings-body">
        {creating && (
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>New architecture type</h3>
            <EditForm
              initial={{}}
              creating
              onSave={handleCreate}
              onCancel={() => setCreating(false)}
            />
          </div>
        )}

        <div className="settings-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div className="header-search" style={{ flex: 1, maxWidth: 320 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
              </svg>
              <input
                placeholder="Filter types…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
              {architectures.length} type{architectures.length !== 1 ? 's' : ''}
            </span>
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)', fontStyle: 'italic' }}>
              {query ? 'No types match your filter.' : 'No architecture types yet.'}
            </div>
          )}

          <div className="arch-list">
            {filtered.map((arch) => {
              const usage = usageByName[arch.name] ?? 0;
              const isEditing = editing?.id === arch.id;
              const isDeleting = confirmDelete?.id === arch.id;

              return (
                <div key={arch.id} className={`arch-row ${isEditing || isDeleting ? 'arch-row--open' : ''}`}>
                  {isEditing ? (
                    <EditForm
                      initial={arch}
                      creating={false}
                      onSave={handleUpdate}
                      onCancel={() => setEditing(null)}
                    />
                  ) : isDeleting ? (
                    <DeleteConfirm
                      arch={arch}
                      others={architectures.filter((a) => a.id !== arch.id)}
                      usageCount={usage}
                      onConfirm={handleDelete}
                      onCancel={() => setConfirmDelete(null)}
                    />
                  ) : (
                    <div className="arch-row-content">
                      <div className="arch-row-main">
                        <div className="arch-name">{arch.name}</div>
                        {arch.description && (
                          <div className="arch-desc">{arch.description}</div>
                        )}
                      </div>
                      <div className="arch-row-meta">
                        <span className="arch-usage">
                          {usage} shelter{usage !== 1 ? 's' : ''}
                        </span>
                        <button
                          className="btn ghost"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => { setEditing(arch); setCreating(false); setConfirmDelete(null); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost"
                          style={{ padding: '3px 8px', fontSize: 11, color: 'var(--rust)' }}
                          onClick={() => { setConfirmDelete(arch); setEditing(null); setCreating(false); }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
