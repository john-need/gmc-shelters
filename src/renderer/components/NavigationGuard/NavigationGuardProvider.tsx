import { createContext, useCallback, useContext, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { clearDirty, saveShelter, saveHistory } from '../../store/sheltersSlice';
import { showToast } from '../../store/uiSlice';

type NavAction = () => void;

// Default (no provider): pass through so components work standalone, e.g. in unit tests.
const GuardContext = createContext<(fn: NavAction) => void>((fn) => fn());

export function useGuardedNav() {
  return useContext(GuardContext);
}

export function NavigationGuardProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const dirty = useSelector((s: RootState) => s.shelters.dirty);
  const historyDirty = useSelector((s: RootState) => s.shelters.historyDirty);
  const editBuffer = useSelector((s: RootState) => s.shelters.editBuffer);
  const historyContent = useSelector((s: RootState) => s.shelters.historyContent);
  const [pending, setPending] = useState<NavAction | null>(null);

  const guardedNav = useCallback(
    (fn: NavAction) => {
      if (dirty || historyDirty) {
        setPending(() => fn);
      } else {
        fn();
      }
    },
    [dirty, historyDirty],
  );

  const runPending = () => {
    const fn = pending;
    setPending(null);
    fn?.();
  };

  const handleDiscard = () => {
    dispatch(clearDirty());
    runPending();
  };

  const handleCancel = () => {
    setPending(null);
  };

  const handleSave = async () => {
    if (dirty && editBuffer) {
      const result = await dispatch(saveShelter(editBuffer));
      if (!saveShelter.fulfilled.match(result)) {
        setPending(null);
        dispatch(showToast({ id: `${Date.now()}-error`, message: 'Could not save shelter. Changes kept.' }));
        return;
      }
    }
    if (historyDirty && editBuffer) {
      const historyRelPath = editBuffer.history ?? `${editBuffer.slug}/${editBuffer.slug}.md`;
      const result = await dispatch(saveHistory({ historyRelPath, content: historyContent }));
      if (!saveHistory.fulfilled.match(result)) {
        setPending(null);
        dispatch(showToast({ id: `${Date.now()}-error`, message: 'Could not save history. Changes kept.' }));
        return;
      }
    }
    runPending();
  };

  return (
    <GuardContext.Provider value={guardedNav}>
      {children}
      {pending && (
        <div className="modal-bg" onClick={handleCancel}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Unsaved changes"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>Unsaved <em>changes</em></h2>
              <div className="sub">You have unsaved changes on this shelter.</div>
            </div>
            <div className="modal-body">
              <p>Save your changes before leaving, or discard them?</p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn" onClick={handleCancel}>Cancel</button>
              <button type="button" className="btn danger" onClick={handleDiscard}>Discard</button>
              <button type="button" className="btn primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </GuardContext.Provider>
  );
}
