import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../store';
import { loadShelters } from '../store/sheltersSlice';
import { loadArchitectures } from '../store/architecturesSlice';
import { loadCategories } from '../store/categoriesSlice';
import Titlebar from '../components/AppShell/Titlebar';
import AppHeader from '../components/AppShell/AppHeader';
import AppBody from '../components/AppShell/AppBody';
import SettingsLayout from '../components/Settings/SettingsLayout';
import Toast from '../components/ui/Toast';
import NewShelterModal from '../components/modals/NewShelterModal';

export default function ShelterBrowser() {
  const dispatch = useDispatch<AppDispatch>();
  const [showNewModal, setShowNewModal] = useState(false);
  const [settingsPage, setSettingsPage] = useState<string | null>(null);

  useEffect(() => {
    dispatch(loadShelters());
    dispatch(loadArchitectures());
    dispatch(loadCategories());
  }, [dispatch]);

  const openSettings = (page: string) => setSettingsPage(page);
  const closeSettings = () => setSettingsPage(null);

  return (
    <div className="app-window">
      <Titlebar />
      <AppHeader onNewShelter={() => setShowNewModal(true)} onOpenSettings={openSettings} />
      {settingsPage ? (
        <SettingsLayout page={settingsPage} setPage={setSettingsPage} onClose={closeSettings} />
      ) : (
        <AppBody />
      )}
      <Toast />
      {showNewModal && <NewShelterModal onClose={() => setShowNewModal(false)} />}
    </div>
  );
}
