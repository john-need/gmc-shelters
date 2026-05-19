import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Titlebar from './Titlebar';

describe('Titlebar', () => {
  beforeEach(() => {
    window.api.app.isFullscreen = jest.fn().mockResolvedValue(false);
    window.api.app.closeWindow = jest.fn().mockResolvedValue(undefined);
    window.api.app.minimizeWindow = jest.fn().mockResolvedValue(undefined);
    window.api.app.toggleFullscreen = jest.fn().mockResolvedValue(undefined);
  });

  it('renders the titlebar element', () => {
    render(<Titlebar />);
    expect(screen.getByTestId('titlebar')).toBeInTheDocument();
  });

  it('renders the app title text', () => {
    render(<Titlebar />);
    expect(screen.getByText(/gmc-shelters/i)).toBeInTheDocument();
  });

  it('renders three traffic-light dots', () => {
    const { container } = render(<Titlebar />);
    expect(container.querySelectorAll('.tl-dot')).toHaveLength(3);
  });

  it('calls close and minimize window actions from the traffic-light controls', async () => {
    render(<Titlebar />);

    fireEvent.click(screen.getByRole('button', { name: /close window/i }));
    fireEvent.click(screen.getByRole('button', { name: /minimize window/i }));

    await waitFor(() => {
      expect(window.api.app.closeWindow).toHaveBeenCalled();
      expect(window.api.app.minimizeWindow).toHaveBeenCalled();
    });
  });

  it('toggles fullscreen and updates the button label', async () => {
    (window.api.app.isFullscreen as jest.Mock)
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    render(<Titlebar />);

    const fullscreenButton = await screen.findByRole('button', { name: /enter fullscreen/i });
    fireEvent.click(fullscreenButton);

    await waitFor(() => {
      expect(window.api.app.toggleFullscreen).toHaveBeenCalled();
    });

    fireEvent.mouseEnter(fullscreenButton);

    await waitFor(() => {
      expect(window.api.app.isFullscreen).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /exit fullscreen/i })).toBeInTheDocument();
    });
  });
});
