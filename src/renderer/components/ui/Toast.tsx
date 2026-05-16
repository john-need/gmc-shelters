import { Alert, Snackbar } from '@mui/material';
import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from '../../store';
import { clearToast } from '../../store/uiSlice';

export default function Toast() {
  const dispatch = useDispatch<AppDispatch>();
  const toast = useSelector((s: RootState) => s.ui.toast);

  const handleClose = () => dispatch(clearToast());

  return (
    <Snackbar
      open={toast !== null}
      autoHideDuration={4000}
      onClose={handleClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={handleClose} severity="info" variant="filled" sx={{ width: '100%' }}>
        {toast?.message}
      </Alert>
    </Snackbar>
  );
}
