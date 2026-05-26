import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { setSelectedId } from '../../store/sheltersSlice';
import { setSidebarCollapsed, setQuery, setFilter, setAdvancedFilters } from '../../store/uiSlice';
import type { AdvancedFilters } from '../../store/uiSlice';
import type { Shelter } from '../../../shared/ipc-types';
import { loadStoredPaths } from '../../pathSettings';
import ShelterRow from './ShelterRow';

export default function Sidebar() {
  const dispatch = useDispatch<AppDispatch>();
  const shelters = useSelector((s: RootState) => s.shelters.list);
  const selectedId = useSelector((s: RootState) => s.shelters.selectedId);
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
  const query = useSelector((s: RootState) => s.ui.query);
  const filter = useSelector((s: RootState) => s.ui.filter);
  const adv = useSelector((s: RootState) => s.ui.advancedFilters);

  const [advOpen, setAdvOpen] = useState(false);
  const [repoRoot, setRepoRoot] = useState('');
  const sheltersRoot = loadStoredPaths().SHELTERS_ROOT;

  useEffect(() => {
    if (typeof window !== 'undefined' && window.api) {
      window.api.app.getRepoRoot().then(setRepoRoot);
    }
  }, []);

  const advActiveCount = useMemo(() => {
    let n = 0;
    if (adv.yearMin) n++;
    if (adv.yearMax) n++;
    if (adv.architecture) n++;
    if (adv.builtBy.trim()) n++;
    if (adv.category) n++;
    if (adv.showOnWeb !== 'any') n++;
    return n;
  }, [adv]);

  const clearAdv = () =>
    dispatch(
      setAdvancedFilters({
        yearMin: '',
        yearMax: '',
        architecture: '',
        builtBy: '',
        category: '',
        showOnWeb: 'any',
      }),
    );

  const setAdvKey =
    <K extends keyof AdvancedFilters>(key: K) =>
    (value: AdvancedFilters[K]) =>
      dispatch(setAdvancedFilters({ [key]: value }));

  const filtered = useMemo(() => {
    let xs = shelters;
    if (query) {
      const q = query.toLowerCase();
      xs = xs.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          (s.built_by || '').toLowerCase().includes(q),
      );
    }
    if (filter === 'extant') xs = xs.filter((s) => s.is_extant);
    if (filter === 'gone') xs = xs.filter((s) => !s.is_extant);
    if (filter === 'gmc') xs = xs.filter((s) => s.is_gmc);

    if (adv.yearMin) {
      const ymin = +adv.yearMin;
      xs = xs.filter((s) => {
        const end = s.end_year ?? new Date().getFullYear();
        return end >= ymin;
      });
    }
    if (adv.yearMax) {
      const ymax = +adv.yearMax;
      xs = xs.filter((s) => (s.start_year ?? 0) <= ymax);
    }
    if (adv.architecture) xs = xs.filter((s) => s.architecture === adv.architecture);
    if (adv.builtBy.trim()) {
      const q = adv.builtBy.toLowerCase().trim();
      xs = xs.filter((s) => (s.built_by || '').toLowerCase().includes(q));
    }
    if (adv.category) xs = xs.filter((s) => s.category === adv.category);
    if (adv.showOnWeb === 'yes') xs = xs.filter((s) => s.show_on_web);
    if (adv.showOnWeb === 'no') xs = xs.filter((s) => !s.show_on_web);
    return xs;
  }, [shelters, query, filter, adv]);

  const sortedShelters = useMemo(() => {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const archOptions = useMemo(
    () => [...new Set(shelters.map((s) => s.architecture).filter(Boolean))].sort() as string[],
    [shelters],
  );
  const catOptions = useMemo(
    () => [...new Set(shelters.map((s) => s.category).filter(Boolean))].sort() as string[],
    [shelters],
  );

  const handleSelect = (id: number) => {
    dispatch(setSelectedId(id));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) return;
      if (selectedId === null) return;

      const idx = sortedShelters.findIndex((s) => s.id === selectedId);
      if (idx === -1) return;

      e.preventDefault();

      const nextIdx = e.key === 'ArrowDown' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= sortedShelters.length) return;

      dispatch(setSelectedId(sortedShelters[nextIdx].id));
      requestAnimationFrame(() => {
        document.querySelector('.shelter-item.selected')?.scrollIntoView({ block: 'nearest' });
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, sortedShelters, dispatch]);

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-head">
        <span className="sidebar-title">Records · {shelters.length}</span>
        <button
          className="sidebar-toggle"
          onClick={() => dispatch(setSidebarCollapsed(!collapsed))}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>
            </svg>
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="sidebar-filter">
          <input
            className="filter-input"
            placeholder="Filter records…"
            value={query}
            onChange={(e) => dispatch(setQuery(e.target.value))}
          />
          <div className="filter-row">
            {(
              [
                { v: 'all', label: 'All' },
                { v: 'extant', label: 'Extant' },
                { v: 'gone', label: 'Lost' },
                { v: 'gmc', label: 'GMC' },
              ] as { v: typeof filter; label: string }[]
            ).map((opt) => (
              <button
                key={opt.v}
                className={`filter-chip ${filter === opt.v ? 'active' : ''}`}
                onClick={() => dispatch(setFilter(opt.v))}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            className={`adv-toggle ${advOpen ? 'open' : ''} ${advActiveCount ? 'has-active' : ''}`}
            onClick={() => setAdvOpen((o) => !o)}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M7 12h10M10 18h4"/>
            </svg>
            <span>Advanced filters</span>
            {advActiveCount > 0 && <span className="adv-count">{advActiveCount}</span>}
            <span style={{ marginLeft: 'auto', display: 'flex' }}>
              <svg
                width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: advOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              >
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </span>
          </button>

          {advOpen && (
            <div className="adv-panel">
              <div className="adv-field">
                <label className="adv-label">Year range</label>
                <div className="adv-year-row">
                  <input
                    className="filter-input mono"
                    type="number"
                    placeholder="1900"
                    value={adv.yearMin}
                    onChange={(e) => setAdvKey('yearMin')(e.target.value)}
                  />
                  <span className="adv-dash">→</span>
                  <input
                    className="filter-input mono"
                    type="number"
                    placeholder="2025"
                    value={adv.yearMax}
                    onChange={(e) => setAdvKey('yearMax')(e.target.value)}
                  />
                </div>
                <span className="adv-hint">overlaps the range, inclusive</span>
              </div>

              <div className="adv-field">
                <label className="adv-label">Category</label>
                <select
                  className="adv-select"
                  value={adv.category}
                  onChange={(e) => setAdvKey('category')(e.target.value)}
                >
                  <option value="">Any category</option>
                  {catOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="adv-field">
                <label className="adv-label">Architecture</label>
                <select
                  className="adv-select"
                  value={adv.architecture}
                  onChange={(e) => setAdvKey('architecture')(e.target.value)}
                >
                  <option value="">Any architecture</option>
                  {archOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              <div className="adv-field">
                <label className="adv-label">Built by</label>
                <input
                  className="filter-input"
                  placeholder="e.g. CCC, Hartwell…"
                  value={adv.builtBy}
                  onChange={(e) => setAdvKey('builtBy')(e.target.value)}
                />
              </div>

              <div className="adv-field">
                <label className="adv-label">Show on web</label>
                <div className="adv-tri">
                  {(['any', 'yes', 'no'] as const).map((v) => (
                    <button
                      key={v}
                      className={`adv-tri-btn ${adv.showOnWeb === v ? 'active' : ''}`}
                      onClick={() => setAdvKey('showOnWeb')(v)}
                    >
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {advActiveCount > 0 && (
                <button className="adv-clear" onClick={clearAdv}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 6 18 18M18 6 6 18"/>
                  </svg>{' '}
                  Clear {advActiveCount} filter{advActiveCount === 1 ? '' : 's'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="shelter-list">
        {sortedShelters.map((s: Shelter) => (
          <ShelterRow
            key={s.id}
            shelter={s}
            selected={s.id === selectedId}
            onSelect={() => handleSelect(s.id)}
            collapsed={collapsed}
            repoRoot={repoRoot}
            sheltersRoot={sheltersRoot}
          />
        ))}

        {filtered.length === 0 && !collapsed && (
          <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 12 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic', fontSize: 14, color: 'var(--ink-2)', marginBottom: 4 }}>
              No matching records.
            </div>
            {advActiveCount > 0 && (
              <button className="btn sm ghost" style={{ marginTop: 6 }} onClick={clearAdv}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6 18 18M18 6 6 18"/>
                </svg>{' '}
                Clear advanced filters
              </button>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="sidebar-footer">
          <span>v1.4 · local db</span>
          <span>
            {filtered.length}/{shelters.length}
          </span>
        </div>
      )}
    </aside>
  );
}
