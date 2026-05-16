import { render, screen, fireEvent, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import uiReducer, { showToast, clearToast } from '../../store/uiSlice';
import sheltersReducer from '../../store/sheltersSlice';
import photosReducer from '../../store/photosSlice';
import sourcesReducer from '../../store/sourcesSlice';
import Toast from './Toast';

function makeStore(preloaded?: object) {
  return configureStore({
    reducer: { ui: uiReducer, shelters: sheltersReducer, photos: photosReducer, sources: sourcesReducer },
    preloadedState: preloaded,
  });
}

function renderToast(preloaded?: object) {
  const store = makeStore(preloaded);
  const result = render(
    <Provider store={store}>
      <Toast />
    </Provider>,
  );
  return { ...result, store };
}

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('renders nothing when no toast in state', () => {
    const { container } = renderToast();
    expect(container.firstChild).toBeNull();
  });

  it('renders toast message when toast is set', () => {
    const { store } = renderToast();
    act(() => { store.dispatch(showToast({ id: '1', message: 'Saved!' })); });
    expect(screen.getByText('Saved!')).toBeInTheDocument();
  });

  it('dismisses on click', () => {
    const { store } = renderToast();
    act(() => { store.dispatch(showToast({ id: '2', message: 'Click me' })); });
    fireEvent.click(screen.getByText('Click me'));
    expect(store.getState().ui.toast).toBeNull();
  });

  it('auto-dismisses after 3 seconds', () => {
    const { store } = renderToast();
    act(() => { store.dispatch(showToast({ id: '3', message: 'Auto' })); });
    expect(screen.getByText('Auto')).toBeInTheDocument();
    act(() => { jest.advanceTimersByTime(3000); });
    expect(store.getState().ui.toast).toBeNull();
  });
});
