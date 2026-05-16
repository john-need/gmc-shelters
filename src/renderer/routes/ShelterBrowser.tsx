import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { loadShelters } from '../store/sheltersSlice';
import Titlebar from '../components/AppShell/Titlebar';
import AppHeader from '../components/AppShell/AppHeader';
import AppBody from '../components/AppShell/AppBody';
import Toast from '../components/ui/Toast';
import NewShelterModal from '../components/modals/NewShelterModal';

export default function ShelterBrowser() {
  const dispatch = useDispatch<AppDispatch>();
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    dispatch(loadShelters());
  }, [dispatch]);

  return (
    <div className="app-window">
      <Titlebar />
      <AppHeader onNewShelter={() => setShowNewModal(true)} />
      <AppBody />
      <Toast />
      {showNewModal && <NewShelterModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}
