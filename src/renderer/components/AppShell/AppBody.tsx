import { Box } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';

const SIDEBAR_EXPANDED = 280;
const SIDEBAR_COLLAPSED = 52;

export default function AppBody() {
  const sidebarCollapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
  const width = sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Sidebar placeholder */}
      <Box
        data-testid="sidebar"
        sx={{
          width,
          flexShrink: 0,
          backgroundColor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          transition: 'width 0.2s ease',
          overflow: 'hidden',
        }}
      />

      {/* Main pane placeholder */}
      <Box
        data-testid="main-pane"
        sx={{ flex: 1, overflow: 'auto', backgroundColor: 'background.default' }}
      />
    </Box>
  );
}
