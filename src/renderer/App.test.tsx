import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { store } from './store';
import theme from './theme';
import App from './App';

function renderApp() {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
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

  it('renders the sidebar placeholder', () => {
    renderApp();
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('renders the main pane placeholder', () => {
    renderApp();
    expect(screen.getByTestId('main-pane')).toBeInTheDocument();
  });
});
