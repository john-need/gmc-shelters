import { useCallback, useEffect, useState } from 'react';

function CloseIcon() {
  return (
    <svg className="tl-icon" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 3 9 9M9 3 3 9" />
    </svg>
  );
}

function MinimizeIcon() {
  return (
    <svg className="tl-icon" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 6h6" />
    </svg>
  );
}

function EnterFullscreenIcon() {
  return (
    <svg className="tl-icon" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.5 2.5H2.5v2M7.5 2.5h2v2M4.5 9.5H2.5v-2M7.5 9.5h2v-2" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg className="tl-icon" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4 5V3h2M8 5V3H6M4 7v2h2M8 7v2H6" />
    </svg>
  );
}

export default function Titlebar() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const refreshFullscreenState = useCallback(async () => {
    if (typeof window === 'undefined' || !window.api) return;
    const fullscreen = await window.api.app.isFullscreen();
    setIsFullscreen(fullscreen);
  }, []);

  useEffect(() => {
    void refreshFullscreenState();
  }, [refreshFullscreenState]);

  const handleClose = async () => {
    await window.api.app.closeWindow();
  };

  const handleMinimize = async () => {
    await window.api.app.minimizeWindow();
  };

  const handleToggleFullscreen = async () => {
    await window.api.app.toggleFullscreen();
    await refreshFullscreenState();
  };

  return (
    <div className="titlebar" data-testid="titlebar">
      <div className="tl-dots">
        <button
          type="button"
          className="tl-dot close"
          aria-label="Close window"
          title="Close window"
          onClick={() => void handleClose()}
        >
          <CloseIcon />
        </button>
        <button
          type="button"
          className="tl-dot min"
          aria-label="Minimize window"
          title="Minimize window"
          onClick={() => void handleMinimize()}
        >
          <MinimizeIcon />
        </button>
        <button
          type="button"
          className="tl-dot max"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onClick={() => void handleToggleFullscreen()}
          onMouseEnter={() => void refreshFullscreenState()}
        >
          {isFullscreen ? <ExitFullscreenIcon /> : <EnterFullscreenIcon />}
        </button>
      </div>
      <div className="titlebar-title">
        GMC Shelters <em>— Archive Manager</em>
      </div>
    </div>
  );
}
