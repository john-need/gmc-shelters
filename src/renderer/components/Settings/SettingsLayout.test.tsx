import { useState } from 'react';
import { fireEvent, render, within } from '@testing-library/react';
import SettingsLayout from './SettingsLayout';
import type { CollectionStatus } from '../../../shared/ipc-types';

const STATUS: CollectionStatus[] = [];

function Wrapper({ initialPage = 'ai' }: { initialPage?: string }) {
  const [page, setPage] = useState(initialPage);
  return <SettingsLayout page={page} setPage={setPage} onClose={() => {}} />;
}

function nav() {
  return within(document.querySelector('.settings-nav') as HTMLElement);
}

function settingsPage() {
  return within(document.querySelector('.settings-page') as HTMLElement);
}

describe('SettingsLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window.api.collections.status as jest.Mock).mockResolvedValue(STATUS);
    (window.api.ai.getApiKey as jest.Mock).mockResolvedValue('');
  });

  it('renders an "AI Settings" nav item distinct from "Collections"', () => {
    render(<Wrapper />);
    expect(nav().getByText(/ai settings/i)).toBeInTheDocument();
    expect(nav().getByText(/^collections$/i)).toBeInTheDocument();
  });

  it('shows the AI Settings page when its nav item is clicked', async () => {
    render(<Wrapper />);
    fireEvent.click(nav().getByText(/ai settings/i));
    expect(await settingsPage().findByText('§ Settings / AI Settings')).toBeInTheDocument();
  });

  it("switches to AI Settings when Collections' link-back button is used", async () => {
    render(<Wrapper initialPage="ai" />);
    const linkBack = await settingsPage().findByRole('button', { name: /ai settings/i });
    fireEvent.click(linkBack);
    expect(await settingsPage().findByText('§ Settings / AI Settings')).toBeInTheDocument();
  });
});
