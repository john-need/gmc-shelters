import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

export default function AboutPage() {
  const [version, setVersion] = useState('1.4.0');
  const shelterCount = useSelector((s: RootState) => s.shelters.list.length);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.api) {
      window.api.app.getVersion().then(setVersion).catch(() => {});
    }
  }, []);

  const build = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const rows = [
    { key: 'VERSION', val: version },
    { key: 'BUILD', val: build },
    { key: 'CITATIONS', val: 'Chicago Manual (NB)' },
    { key: 'DB ENGINE', val: 'SQLite 3.45' },
    { key: 'RECORDS', val: `${shelterCount} shelters` },
    { key: 'LICENSE', val: 'MIT' },
  ];

  return (
    <>
      <div className="settings-page-head">
        <div>
          <div
            className="settings-page-title"
            dangerouslySetInnerHTML={{ __html: 'About <em>· this archive</em>' }}
          />
          <div className="settings-page-sub">§ Settings / About</div>
        </div>
      </div>

      <div className="settings-body">
        <div className="settings-card">
          <h3>GMC Shelters <em>· Archive Manager</em></h3>
          <div className="desc">
            A desktop application for cataloging Green Mountain Club shelters, their photographs, sources, and field markers.
          </div>
          <div className="about-grid">
            {rows.map(({ key, val }) => (
              <div key={key} className="row">
                <span className="key">{key}</span>
                <span className="val">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
