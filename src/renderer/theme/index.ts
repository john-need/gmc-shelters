import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#2d4a32',
      dark: '#1f3524',
      contrastText: '#faf4e3',
    },
    secondary: {
      main: '#b54d2c',
      dark: '#8e3a1f',
      contrastText: '#faf4e3',
    },
    background: {
      default: '#f3ecdb',
      paper: '#faf4e3',
    },
    text: {
      primary: '#1c170d',
      secondary: '#7a6f56',
    },
  },
  typography: {
    fontFamily: '"Geist", -apple-system, BlinkMacSystemFont, "Helvetica Neue", system-ui, sans-serif',
    h1: {
      fontFamily: '"Newsreader", "Iowan Old Style", Georgia, serif',
    },
    h2: {
      fontFamily: '"Newsreader", "Iowan Old Style", Georgia, serif',
    },
    h3: {
      fontFamily: '"Newsreader", "Iowan Old Style", Georgia, serif',
    },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: '#f3ecdb',
        },
      },
    },
  },
});

export default theme;
