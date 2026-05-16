import { useEffect } from 'react';
import { Box } from '@mui/material';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { loadShelters } from '../store/sheltersSlice';
import Titlebar from '../components/AppShell/Titlebar';
import AppHeader from '../components/AppShell/AppHeader';
import AppBody from '../components/AppShell/AppBody';
import Toast from '../components/ui/Toast';

export default function ShelterBrowser() {
  const dispatch = useDispatch<AppDispatch>();

  useEffect(() => {
    dispatch(loadShelters());
  }, [dispatch]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'background.default',
      }}
    >
      <Titlebar />
      <AppHeader />
      <AppBody />
      <Toast />
    </Box>
  );
}
