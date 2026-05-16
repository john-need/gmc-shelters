import { AppBar, Box, Button, TextField, Toolbar, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import type { AppDispatch } from '../../store';
import { showToast } from '../../store/uiSlice';

const STUB_ACTIONS = ['Export', 'Publish to web', 'New Shelter'] as const;

export default function AppHeader() {
  const dispatch = useDispatch<AppDispatch>();

  const handleStub = (label: string) => {
    dispatch(
      showToast({
        id: Date.now().toString(),
        message: `${label} not yet implemented.`,
      }),
    );
  };

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ backgroundColor: 'primary.main', height: 56, flexShrink: 0 }}
    >
      <Toolbar sx={{ minHeight: 56, gap: 2 }}>
        <Typography
          variant="h6"
          component="div"
          sx={{
            fontFamily: '"Newsreader", "Iowan Old Style", Georgia, serif',
            fontWeight: 600,
            color: 'primary.contrastText',
            flexShrink: 0,
          }}
        >
          GMC Shelters
        </Typography>

        <TextField
          size="small"
          placeholder="Search shelters… (⌘K)"
          variant="outlined"
          sx={{
            flex: 1,
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              backgroundColor: 'rgba(255,255,255,0.1)',
              color: 'primary.contrastText',
              '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
            },
          }}
        />

        <Box sx={{ display: 'flex', gap: 1, ml: 'auto' }}>
          {STUB_ACTIONS.map((label) => (
            <Button
              key={label}
              variant="outlined"
              size="small"
              onClick={() => handleStub(label)}
              sx={{
                color: 'primary.contrastText',
                borderColor: 'rgba(255,255,255,0.4)',
                '&:hover': { borderColor: 'primary.contrastText' },
              }}
            >
              {label}
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}
