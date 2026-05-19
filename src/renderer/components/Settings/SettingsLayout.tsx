import PublishingPage from './PublishingPage';
import ArchitecturesPage from './ArchitecturesPage';
import CategoriesPage from './CategoriesPage';
import PathsPage from './PathsPage';
import AboutPage from './AboutPage';

interface Props {
  page: string;
  setPage: (p: string) => void;
  onClose: () => void;
}

const pages = [
  {
    id: 'publishing',
    label: 'Publishing',
    sub: 'site & deploy',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
  },
  {
    id: 'architectures',
    label: 'Architectures',
    sub: 'type taxonomy',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
  },
  {
    id: 'categories',
    label: 'Shelter categories',
    sub: 'type classification',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h16M4 12h16M4 18h7"/>
      </svg>
    ),
  },
  {
    id: 'paths',
    label: 'Paths',
    sub: 'data locations',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: 'about',
    label: 'About',
    sub: 'version & credits',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    ),
  },
];

export default function SettingsLayout({ page, setPage, onClose }: Props) {
  return (
    <div className="settings-layout">
      <aside className="settings-nav">
        <div className="settings-nav-head">
          <span>Settings</span>
          <button className="settings-back" onClick={onClose}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
        </div>
        {pages.map((p) => (
          <button
            key={p.id}
            className={`settings-nav-item ${page === p.id ? 'active' : ''}`}
            onClick={() => setPage(p.id)}
          >
            <span className="ico">{p.icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span>{p.label}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 9,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                color: 'var(--ink-3)', fontWeight: 400,
              }}>{p.sub}</span>
            </div>
          </button>
        ))}
      </aside>

      <div className="settings-page">
        {page === 'publishing' && <PublishingPage />}
        {page === 'architectures' && <ArchitecturesPage />}
        {page === 'categories' && <CategoriesPage />}
        {page === 'paths' && <PathsPage />}
        {page === 'about' && <AboutPage />}
      </div>
    </div>
  );
}
