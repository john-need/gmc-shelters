import { useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from '../../store/categoriesSlice';
import { showToast } from '../../store/uiSlice';
import type { Category } from '../../../shared/ipc-types';

interface EditFormProps {
  initial: Partial<Category>;
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
          placeholder="e.g. Lodge"
        />
      </div>
      <div className="field">
        <label className="label">Description <span className="hint">optional</span></label>
        <textarea
          className="textarea"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this shelter category…"
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
              Add category
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
  cat: Category;
  others: Category[];
  onConfirm: (reassignTo: string) => void;
  onCancel: () => void;
  usageCount: number;
}

function DeleteConfirm({ cat, others, onConfirm, onCancel, usageCount }: DeleteConfirmProps) {
  const [reassignTo, setReassignTo] = useState('');
  const needsReassign = usageCount > 0;

  return (
    <div className="arch-delete-confirm">
      <div className="arch-delete-confirm-msg">
        {needsReassign ? (
          <>
            <strong>{usageCount} shelter{usageCount !== 1 ? 's' : ''}</strong> use &ldquo;{cat.name}&rdquo;.
            Choose a replacement before deleting.
          </>
        ) : (
          <>Delete &ldquo;{cat.name}&rdquo;? This cannot be undone.</>
        )}
      </div>
      {needsReassign && (
        <div className="field" style={{ marginTop: 10 }}>
          <label className="label">Reassign to</label>
          <select className="select" value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="">— choose —</option>
            {others.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
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

export default function CategoriesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const categories = useSelector((s: RootState) => s.categories.list);
  const shelters = useSelector((s: RootState) => s.shelters.list);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Category | null>(null);

  const usageByName = useMemo(() => {
    const m: Record<string, number> = {};
    shelters.forEach((s) => {
      if (s.category) m[s.category] = (m[s.category] ?? 0) + 1;
    });
    return m;
  }, [shelters]);

  const filtered = useMemo(() => {
    if (!query) return categories;
    const q = query.toLowerCase();
    return categories.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
    );
  }, [categories, query]);

  const handleCreate = (name: string, description: string) => {
    dispatch(createCategory({ name, description })).then(() => {
      dispatch(showToast({ id: Date.now().toString(), message: `Added "${name}"` }));
    });
    setCreating(false);
  };

  const handleUpdate = (name: string, description: string) => {
    if (!editing) return;
    dispatch(updateCategory({ ...editing, name, description })).then(() => {
      dispatch(showToast({ id: Date.now().toString(), message: `Saved "${name}"` }));
    });
    setEditing(null);
  };

  const handleDelete = (reassignTo: string) => {
    if (!confirmDelete) return;
    dispatch(deleteCategory({ id: confirmDelete.id, reassignTo: reassignTo || undefined })).then(() => {
      const msg = reassignTo
        ? `Deleted · ${usageByName[confirmDelete.name] ?? 0} record(s) reassigned to "${reassignTo}"`
        : `Deleted "${confirmDelete.name}"`;
      dispatch(showToast({ id: Date.now().toString(), message: msg }));
    });
    setConfirmDelete(null);
  };

  return (
    <>
      <div className="settings-page-head">
        <div>
          <div className="settings-page-title" dangerouslySetInnerHTML={{ __html: 'Shelter categories <em>· classification</em>' }} />
          <div className="settings-page-sub">§ Settings / Shelter categories</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn primary"
            onClick={() => { setCreating(true); setEditing(null); }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            New category
          </button>
        </div>
      </div>

      <div className="settings-body">
        {creating && (
          <div className="settings-card" style={{ marginBottom: 16 }}>
            <h3>New shelter category</h3>
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
                placeholder="Filter categories…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--ink-3)' }}>
              {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
            </span>
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ink-3)', fontStyle: 'italic' }}>
              {query ? 'No categories match your filter.' : 'No shelter categories yet.'}
            </div>
          )}

          <div className="arch-list">
            {filtered.map((cat) => {
              const usage = usageByName[cat.name] ?? 0;
              const isEditing = editing?.id === cat.id;
              const isDeleting = confirmDelete?.id === cat.id;

              return (
                <div key={cat.id} className={`arch-row ${isEditing || isDeleting ? 'arch-row--open' : ''}`}>
                  {isEditing ? (
                    <EditForm
                      initial={cat}
                      creating={false}
                      onSave={handleUpdate}
                      onCancel={() => setEditing(null)}
                    />
                  ) : isDeleting ? (
                    <DeleteConfirm
                      cat={cat}
                      others={categories.filter((c) => c.id !== cat.id)}
                      usageCount={usage}
                      onConfirm={handleDelete}
                      onCancel={() => setConfirmDelete(null)}
                    />
                  ) : (
                    <div className="arch-row-content">
                      <div className="arch-row-main">
                        <div className="arch-name">{cat.name}</div>
                        {cat.description && (
                          <div className="arch-desc">{cat.description}</div>
                        )}
                      </div>
                      <div className="arch-row-meta">
                        <span className="arch-usage">
                          {usage} shelter{usage !== 1 ? 's' : ''}
                        </span>
                        <button
                          className="btn ghost"
                          style={{ padding: '3px 8px', fontSize: 11 }}
                          onClick={() => { setEditing(cat); setCreating(false); setConfirmDelete(null); }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn ghost"
                          style={{ padding: '3px 8px', fontSize: 11, color: 'var(--rust)' }}
                          onClick={() => { setConfirmDelete(cat); setEditing(null); setCreating(false); }}
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
