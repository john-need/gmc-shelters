import { render, screen } from '@testing-library/react';
import Titlebar from './Titlebar';

describe('Titlebar', () => {
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
});
