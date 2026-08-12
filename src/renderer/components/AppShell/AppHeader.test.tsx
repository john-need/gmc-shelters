import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from '../../store/uiSlice';
import sheltersReducer from '../../store/sheltersSlice';
import photosReducer from '../../store/photosSlice';
import sourcesReducer from '../../store/sourcesSlice';
import AppHeader from './AppHeader';

function makeStore(shelterCount = 0) {
  return configureStore({
    reducer: { ui: uiReducer, shelters: sheltersReducer, photos: photosReducer, sources: sourcesReducer },
    preloadedState: {
      shelters: {
        list: Array.from({ length: shelterCount }, (_, i) => ({
          id: i + 1, name: `Shelter ${i + 1}`, slug: `shelter-${i + 1}`,
          start_year: 1960, end_year: null, description: '', category: 'lean-to',
          architecture: '', built_by: '', notes: '',
          is_extant: true, is_gmc: false, show_on_web: false, default_photo_id: null, history: null,
          created: '2020-01-01', updated: '2020-01-01', photo_count: 0,
        })),
        selectedId: null, editBuffer: null, loading: false, saving: false,
        dirty: false, historyContent: '', historyOriginal: '', historyDirty: false, historyMissing: false,
      },
    },
  });
}

describe('AppHeader', () => {
  it('renders the New shelter button', () => {
    const store = makeStore();
    const onNew = jest.fn();
    render(<Provider store={store}><AppHeader onNewShelter={onNew} onOpenSettings={jest.fn()} /></Provider>);
    expect(screen.getByText('New shelter')).toBeInTheDocument();
  });

  it('calls onNewShelter when New shelter is clicked', () => {
    const store = makeStore();
    const onNew = jest.fn();
    render(<Provider store={store}><AppHeader onNewShelter={onNew} onOpenSettings={jest.fn()} /></Provider>);
    fireEvent.click(screen.getByText('New shelter'));
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it('shows record count from store', () => {
    const store = makeStore(5);
    render(<Provider store={store}><AppHeader onNewShelter={jest.fn()} onOpenSettings={jest.fn()} /></Provider>);
    expect(screen.getByText(/5 records/)).toBeInTheDocument();
  });

  it('does not render Publish to web', () => {
    const store = makeStore();
    render(<Provider store={store}><AppHeader onNewShelter={jest.fn()} onOpenSettings={jest.fn()} /></Provider>);
    expect(screen.queryByRole('button', { name: /publish to web/i })).not.toBeInTheDocument();
  });

  it('opens a blocking modal immediately when Export is clicked, before the build resolves', async () => {
    const store = makeStore();
    let resolveBuild: (value: unknown) => void = () => {};
    (window.api.export.build as jest.Mock).mockReturnValue(new Promise((resolve) => { resolveBuild = resolve; }));

    render(<Provider store={store}><AppHeader onNewShelter={jest.fn()} onOpenSettings={jest.fn()} /></Provider>);
    fireEvent.click(screen.getByText('Export'));

    expect(screen.getByText('Export', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /export/i })).toBeDisabled();

    resolveBuild({ cancelled: false, savedTo: '/tmp/out.zip', shelterCount: 1, photoCount: 1, skippedPhotos: 0 });
    await screen.findByRole('button', { name: 'Dismiss' });
  });

  it('closes the export modal and calls the cancel API when Cancel is clicked', async () => {
    const store = makeStore();
    (window.api.export.build as jest.Mock).mockReturnValue(new Promise(() => {})); // never resolves

    render(<Provider store={store}><AppHeader onNewShelter={jest.fn()} onOpenSettings={jest.fn()} /></Provider>);
    fireEvent.click(screen.getByText('Export'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(window.api.export.cancel).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('opens the AI Settings page from the settings cog menu', () => {
    const store = makeStore();
    const onOpenSettings = jest.fn();
    render(<Provider store={store}><AppHeader onNewShelter={jest.fn()} onOpenSettings={onOpenSettings} /></Provider>);
    fireEvent.click(screen.getByTitle('Settings'));
    fireEvent.click(screen.getByText('AI Settings'));
    expect(onOpenSettings).toHaveBeenCalledWith('ai-settings');
  });
});
