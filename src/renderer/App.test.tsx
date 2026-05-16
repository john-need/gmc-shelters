import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from './store';
import App from './App';

function renderApp() {
  return render(
    <Provider store={store}>
      <App />
    </Provider>,
  );
}

describe('App', () => {
  it('renders without crashing', () => {
    expect(() => renderApp()).not.toThrow();
  });

  it('renders the Titlebar element', () => {
    renderApp();
    expect(screen.getByTestId('titlebar')).toBeInTheDocument();
  });

  it('renders the sidebar', () => {
    renderApp();
    expect(screen.getByRole('complementary')).toBeInTheDocument();
  });

  it('renders the main pane', () => {
    renderApp();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
