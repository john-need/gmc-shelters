import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import AiSettingsPage from './AiSettingsPage';

describe('AiSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('');
    (window.api.ai.getModel as jest.Mock).mockResolvedValue('default');
  });

  it('renders an "AI Settings" header', async () => {
    render(<AiSettingsPage />);
    expect(await screen.findByText('§ Settings / AI Settings')).toBeInTheDocument();
  });

  it('loads the saved key on mount', async () => {
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('sk-ant-x');
    render(<AiSettingsPage />);
    expect(await screen.findByLabelText(/anthropic api key/i)).toHaveValue('sk-ant-x');
  });

  it('saves the API key entered', async () => {
    render(<AiSettingsPage />);
    fireEvent.change(await screen.findByLabelText(/anthropic api key/i), {
      target: { value: 'sk-ant-new456' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    await waitFor(() => {
      expect(window.api.ai.setApiKey).toHaveBeenCalledWith('sk-ant-new456');
    });
  });

  it('rejects a malformed API key', async () => {
    render(<AiSettingsPage />);
    fireEvent.change(await screen.findByLabelText(/anthropic api key/i), {
      target: { value: 'not-a-key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));
    expect(await screen.findByText(/should start with/i)).toBeInTheDocument();
    expect(window.api.ai.setApiKey).not.toHaveBeenCalled();
  });

  it('removes the key', async () => {
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('sk-ant-x');
    render(<AiSettingsPage />);
    fireEvent.click(await screen.findByRole('button', { name: /remove key/i }));
    await waitFor(() => {
      expect(window.api.ai.setApiKey).toHaveBeenCalledWith('');
    });
  });

  it('renders exactly two model options, pre-selecting the current tier', async () => {
    (window.api.ai.getModel as jest.Mock).mockResolvedValue('escalation');
    render(<AiSettingsPage />);
    const select = await screen.findByLabelText(/^model$/i);
    expect(select).toHaveValue('escalation');
    const options = within(select).getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Fast (default)');
    expect(options[1]).toHaveTextContent('Capable (escalation)');
  });

  it('saves the model choice immediately on change, with no separate save action', async () => {
    render(<AiSettingsPage />);
    const select = await screen.findByLabelText(/^model$/i);
    fireEvent.change(select, { target: { value: 'escalation' } });
    await waitFor(() => {
      expect(window.api.ai.setModel).toHaveBeenCalledWith('escalation');
    });
  });

  it('the model dropdown works even when no API key has been saved yet', async () => {
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('');
    (window.api.ai.getModel as jest.Mock).mockResolvedValue('default');
    render(<AiSettingsPage />);
    const select = await screen.findByLabelText(/^model$/i);
    expect(select).toHaveValue('default');
    fireEvent.change(select, { target: { value: 'escalation' } });
    await waitFor(() => {
      expect(window.api.ai.setModel).toHaveBeenCalledWith('escalation');
    });
  });
});
