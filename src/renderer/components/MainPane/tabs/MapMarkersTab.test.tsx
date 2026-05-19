import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import mapMarkersReducer, { createMarker, deleteMarker } from '../../../store/mapMarkersSlice';
import sheltersReducer from '../../../store/sheltersSlice';
import uiReducer from '../../../store/uiSlice';
import MapMarkersTab from './MapMarkersTab';
import type { MapMarker, Shelter } from '../../../../shared/ipc-types';

// Mock Leaflet 2.0 — jsdom has no real layout engine.
// Leaflet 2.0 uses constructors (new L.Map, new L.Marker, etc.) not factory fns.
jest.mock('leaflet', () => {
  const mockMarker = {
    addTo: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    remove: jest.fn(),
    setIcon: jest.fn(),
    getLatLng: jest.fn(() => ({ lat: 44.1, lng: -71.5 })),
  };
  const mapStub = {
    on: jest.fn(),
    off: jest.fn(),
    remove: jest.fn(),
    getContainer: jest.fn(() => ({ style: {} as CSSStyleDeclaration })),
  };
  return {
    __esModule: true,
    default: {
      Map: jest.fn(() => mapStub),
      TileLayer: jest.fn(() => ({ addTo: jest.fn() })),
      DivIcon: jest.fn(() => ({})),
      Marker: jest.fn(() => ({ ...mockMarker })),
    },
  };
});

function makeShelter(overrides: Partial<Shelter> = {}): Shelter {
  return {
    id: 10, name: 'Test Shelter', slug: 'test-shelter',
    start_year: 1950, end_year: 2000,
    description: '',
    default_photo_id: null, is_gmc: false, is_extant: false,
    architecture: '', built_by: '', notes: '',
    created: '2020-01-01', updated: '2020-01-01',
    category: '', show_on_web: false,
    ...overrides,
  };
}

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.1234, longitude: -71.5678,
    name: 'Original Site', start_year: 1960, end_year: 1975,
    change_type: 'Original', notes: '', is_extant: false,
    photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

function makeStore(markers: MapMarker[] = [], shelterId = 10) {
  return configureStore({
    reducer: { mapMarkers: mapMarkersReducer, shelters: sheltersReducer, ui: uiReducer },
    preloadedState: {
      mapMarkers: {
        byShelter: markers.length > 0 ? { [shelterId]: markers } : {},
        loading: false, error: null,
      },
    } as any,
  });
}

const shelter = makeShelter();
const defaultProps = { shelterId: 10, shelter };

describe('MapMarkersTab', () => {
  describe('empty state', () => {
    it('shows empty-state message with add prompt', () => {
      const store = makeStore([]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getByText(/no map markers/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add.*marker/i })).toBeInTheDocument();
    });
  });

  describe('list rendering', () => {
    const markers = [
      makeMarker({ id: 1, name: 'Site A', start_year: 1960, end_year: 1975, change_type: 'Original' }),
      makeMarker({ id: 2, name: 'Site B', start_year: 1975, end_year: 1990, change_type: 'Moved' }),
      makeMarker({ id: 3, name: 'Site C', start_year: 1990, end_year: null, change_type: 'Renamed', is_extant: true }),
    ];

    it('renders all markers', () => {
      const store = makeStore(markers);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getByText('Site A')).toBeInTheDocument();
      expect(screen.getByText('Site B')).toBeInTheDocument();
      expect(screen.getByText('Site C')).toBeInTheDocument();
    });

    it('displays coordinates', () => {
      const store = makeStore([makeMarker()]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getByText(/44\.1234/)).toBeInTheDocument();
      expect(screen.getByText(/71\.5678/)).toBeInTheDocument();
    });

    it('displays year ranges', () => {
      const store = makeStore(markers);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getAllByText(/1960/)[0]).toBeInTheDocument();
      expect(screen.getAllByText(/1975/)[0]).toBeInTheDocument();
    });

    it('displays "present" for null end_year', () => {
      const store = makeStore(markers);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getByText(/present/i)).toBeInTheDocument();
    });

    it('displays change types', () => {
      const store = makeStore(markers);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getByText('Original')).toBeInTheDocument();
      expect(screen.getByText('Moved')).toBeInTheDocument();
    });

    it('renders markers in start_year order', () => {
      const shuffled = [
        makeMarker({ id: 3, name: 'C', start_year: 1990, end_year: null }),
        makeMarker({ id: 1, name: 'A', start_year: 1960, end_year: 1975 }),
        makeMarker({ id: 2, name: 'B', start_year: 1975, end_year: 1990 }),
      ];
      const store = makeStore(shuffled);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      const names = screen.getAllByTestId('marker-name').map((el) => el.textContent);
      expect(names).toEqual(['A', 'B', 'C']);
    });
  });

  describe('count badge', () => {
    it('reports correct count via rendered markers', () => {
      const markers = [makeMarker({ id: 1 }), makeMarker({ id: 2 })];
      const store = makeStore(markers);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getAllByTestId('marker-row')).toHaveLength(2);
    });

    it('count updates after createMarker.fulfilled', () => {
      const store = makeStore([makeMarker({ id: 1 })]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getAllByTestId('marker-row')).toHaveLength(1);

      const newMarker = makeMarker({ id: 2, start_year: 1975, end_year: 1990 });
      act(() => {
        store.dispatch(createMarker.fulfilled(
          { shelterId: 10, markers: [makeMarker({ id: 1 }), newMarker] },
          '',
          { shelter_id: 10, latitude: 44, longitude: -71, name: 'New', start_year: 1975, change_type: 'Moved', notes: '' },
        ));
      });
      expect(screen.getAllByTestId('marker-row')).toHaveLength(2);
    });

    it('count updates after deleteMarker.fulfilled', () => {
      const markers = [makeMarker({ id: 1 }), makeMarker({ id: 2, start_year: 1975, end_year: 1990 })];
      const store = makeStore(markers);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getAllByTestId('marker-row')).toHaveLength(2);

      act(() => {
        store.dispatch(deleteMarker.fulfilled(
          { shelterId: 10, markers: [makeMarker({ id: 1 })] },
          '',
          { id: 2, shelterId: 10 },
        ));
      });
      expect(screen.getAllByTestId('marker-row')).toHaveLength(1);
    });
  });

  describe('Add Marker form', () => {
    beforeEach(() => {
      (window as any).api = {
        mapMarkers: {
          create: jest.fn().mockResolvedValue([makeMarker({ id: 99 })]),
          delete: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue(makeMarker()),
          getByShelter: jest.fn().mockResolvedValue([]),
        },
      };
    });

    it('shows Add Marker button', () => {
      const store = makeStore([]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getByRole('button', { name: /add.*marker/i })).toBeInTheDocument();
    });

    it('opens form when Add Marker is clicked', () => {
      const store = makeStore([]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: /add.*marker/i }));
      expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
    });

    it('disables Save until lat and lon are filled', () => {
      const store = makeStore([]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: /add.*marker/i }));
      const saveBtn = screen.getByRole('button', { name: /save/i });
      expect(saveBtn).toBeDisabled();
      fireEvent.change(screen.getByLabelText(/latitude/i), { target: { value: '44.1' } });
      fireEvent.change(screen.getByLabelText(/longitude/i), { target: { value: '-71.5' } });
      expect(saveBtn).not.toBeDisabled();
    });


    it('closes form on Cancel', () => {
      const store = makeStore([]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: /add.*marker/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByLabelText(/latitude/i)).not.toBeInTheDocument();
    });
  });

  describe('Edit mode', () => {
    const marker = makeMarker({ id: 1, name: 'Original Site', latitude: 44.1, longitude: -71.5 });

    beforeEach(() => {
      (window as any).api = {
        mapMarkers: {
          update: jest.fn().mockResolvedValue({ ...marker, name: 'Updated Site' }),
          delete: jest.fn().mockResolvedValue([]),
          create: jest.fn().mockResolvedValue([marker]),
          getByShelter: jest.fn().mockResolvedValue([marker]),
        },
      };
    });

    it('populates form with current values', () => {
      const store = makeStore([marker]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      expect((screen.getByLabelText(/latitude/i) as HTMLInputElement).value).toBe('44.1');
    });

    it('returns to list on Cancel without saving', () => {
      const store = makeStore([marker]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: /edit/i }));
      fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
      expect(screen.queryByLabelText(/latitude/i)).not.toBeInTheDocument();
      expect((window as any).api.mapMarkers.update).not.toHaveBeenCalled();
    });
  });

  describe('Delete', () => {
    const marker = makeMarker({ id: 1 });

    it('renders Delete button for each marker', () => {
      const store = makeStore([marker]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('removes marker from store when delete succeeds', async () => {
      (window as any).api = {
        mapMarkers: {
          delete: jest.fn().mockResolvedValue([]),
          create: jest.fn(),
          update: jest.fn(),
          getByShelter: jest.fn().mockResolvedValue([marker]),
        },
      };
      const store = makeStore([marker]);
      render(<Provider store={store}><MapMarkersTab {...defaultProps} /></Provider>);
      fireEvent.click(screen.getByRole('button', { name: /delete/i }));
      await screen.findByText(/no map markers/i);
      expect(store.getState().mapMarkers.byShelter[10]).toHaveLength(0);
    });
  });
});
