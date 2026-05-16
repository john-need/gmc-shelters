import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { clearToast } from '../../store/uiSlice';

export default function Toast() {
  const dispatch = useDispatch<AppDispatch>();
  const toast = useSelector((s: RootState) => s.ui.toast);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => dispatch(clearToast()), 3000);
    return () => clearTimeout(t);
  }, [toast, dispatch]);

  if (!toast) return null;

  return (
    <div className="toast-custom" onClick={() => dispatch(clearToast())}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5 10 17 19 7.5"/>
      </svg>
      {toast.message}
    </div>
  );
}
