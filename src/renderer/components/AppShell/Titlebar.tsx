import { Box } from '@mui/material';

const TRAFFIC_LIGHTS = [
  { color: '#ff5f57', label: 'close' },
  { color: '#febc2e', label: 'minimize' },
  { color: '#28c840', label: 'maximize' },
];

export default function Titlebar() {
  return (
    <Box
      data-testid="titlebar"
      sx={{
        height: 38,
        backgroundColor: '#1c1813',
        WebkitAppRegion: 'drag',
        display: 'flex',
        alignItems: 'center',
        pl: 2,
        gap: 0.75,
        flexShrink: 0,
      }}
    >
      {TRAFFIC_LIGHTS.map(({ color, label }) => (
        <Box
          key={label}
          aria-label={label}
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            backgroundColor: color,
            flexShrink: 0,
          }}
        />
      ))}
    </Box>
  );
}
