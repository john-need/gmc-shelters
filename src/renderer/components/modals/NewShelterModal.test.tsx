import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import uiReducer from '../../store/uiSlice';
import sheltersReducer from '../../store/sheltersSlice';
import photosReducer from '../../store/photosSlice';
import sourcesReducer from '../../store/sourcesSlice';
import categoriesReducer from '../../store/categoriesSlice';
import NewShelterModal from './NewShelterModal';

function makeStore() {
  return configureStore({
    reducer: { ui: uiReducer, shelters: sheltersReducer, photos: photosReducer, sources: sourcesReducer, categories: categoriesReducer },
  });
}

function renderModal(onClose = jest.fn()) {
  const store = makeStore();
  const result = render(
    <Provider store={store}>
      <NewShelterModal onClose={onClose} />
    </Provider>,
  );
  return { ...result, store, onClose };
}

describe('NewShelterModal', () => {
  it('renders the form', () => {
    renderModal();
    expect(screen.getByText('Add a new shelter record')).toBeInTheDocument();
  });

  it('Create record button is disabled when name is empty', () => {
    renderModal();
    expect(screen.getByText('Create record').closest('button')).toBeDisabled();
  });

  it('Create record button enables when name is filled', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Mossy Brook/i), { target: { value: 'New Shelter' } });
    expect(screen.getByText('Create record').closest('button')).not.toBeDisabled();
  });

  it('auto-generates slug from name', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Mossy Brook/i), { target: { value: 'Bear Notch Shelter' } });
    expect(screen.getByDisplayValue('bear-notch-shelter')).toBeInTheDocument();
    expect(screen.getByText('/shelters/bear-notch-shelter/bear-notch-shelter.md')).toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', () => {
    const { onClose } = renderModal();
    fireEvent.click(screen.getByText('Add a new shelter record').closest('.modal-bg')!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('clearing the year field shows blank, not 0', () => {
    renderModal();
    const yearInput = screen.getByDisplayValue(String(new Date().getFullYear()));
    fireEvent.change(yearInput, { target: { value: '' } });
    expect((yearInput as HTMLInputElement).value).toBe('');
  });

  it('Create record button is disabled when year is cleared', () => {
    renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Mossy Brook/i), { target: { value: 'New Shelter' } });
    const yearInput = screen.getByDisplayValue(String(new Date().getFullYear()));
    fireEvent.change(yearInput, { target: { value: '' } });
    expect(screen.getByText('Create record').closest('button')).toBeDisabled();
  });

  it('submits and dispatches createShelter on form submission', async () => {
    const mockShelter = {
      id: 1, name: 'Test Shelter', slug: 'test-shelter', start_year: 2020,
      end_year: null, category: 'Shelter', architecture: '', built_by: '',
      description: '', notes: '',
      is_extant: true, is_gmc: false, show_on_web: false, default_photo_id: null,
      created: '2020-01-01', updated: '2020-01-01', photo_count: 0,
    };
    (window.api.shelters.create as jest.Mock).mockResolvedValue(mockShelter);

    const { store, onClose } = renderModal();
    fireEvent.change(screen.getByPlaceholderText(/Mossy Brook/i), { target: { value: 'Test Shelter' } });
    fireEvent.click(screen.getByText('Create record').closest('button')!);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(store.getState().shelters.list.length).toBeGreaterThan(0);
    expect(store.getState().shelters.list[0].name).toBe('Test Shelter');
  });
});
