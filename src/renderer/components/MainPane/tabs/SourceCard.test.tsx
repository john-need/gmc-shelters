import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SourceCard from './SourceCard';
import type { Source } from '../../../../shared/ipc-types';

function makeSource(overrides: Partial<Source> = {}): Source {
  return {
    id: 1, shelter_id: 7, include_in_history: false,
    type: 'book', author: 'Doe, Jane', title: 'The Green Mountain Trail',
    container_title: '', container_author: '', editor: '', edition: '', volume: '', issue: '', pages: '',
    publisher: 'GMC Press', place: 'Waterbury', year: 1972, date: '',
    url: '', access_date: '', archive: '', archive_location: '',
    annotation: '', notes: '', quote: '',
    created: '2020-01-01', updated: '2020-01-02',
    ...overrides,
  };
}

const baseProps = {
  onToggleInclude: jest.fn(),
  onEdit: jest.fn(),
  onDelete: jest.fn(),
  hasValidApiKey: true,
  cleaning: false,
  onCleanUpQuote: jest.fn(),
};

describe('SourceCard', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the type badge', () => {
    render(<SourceCard s={makeSource()} {...baseProps} />);
    expect(screen.getByText('Book')).toBeInTheDocument();
  });

  it('renders a prominent title', () => {
    render(<SourceCard s={makeSource({ title: 'The Green Mountain Trail' })} {...baseProps} />);
    expect(document.querySelector('.source-title')).toHaveTextContent('The Green Mountain Trail');
  });

  it('renders the year as the prominent publication date when set', () => {
    render(<SourceCard s={makeSource({ type: 'website', year: 1972, date: '' })} {...baseProps} />);
    expect(document.querySelector('.source-pubdate')).toHaveTextContent('1972');
  });

  it('falls back to the full date as the prominent publication date when year is not set', () => {
    render(<SourceCard s={makeSource({ type: 'website', year: null, date: '1998-05-02' })} {...baseProps} />);
    expect(document.querySelector('.source-pubdate')).toHaveTextContent('1998-05-02');
  });

  it('omits the prominent publication date when neither year nor date is set', () => {
    render(<SourceCard s={makeSource({ type: 'website', year: null, date: '' })} {...baseProps} />);
    expect(document.querySelector('.source-pubdate')).not.toBeInTheDocument();
  });

  it('shows the publication year in the heading for books, magazine-style', () => {
    render(<SourceCard s={makeSource({ type: 'book', year: 1972 })} {...baseProps} />);
    expect(document.querySelector('.source-pubdate')).toHaveTextContent('1972');
  });

  it('renders the formatted citation', () => {
    render(<SourceCard s={makeSource()} {...baseProps} />);
    expect(document.querySelector('.source-citation')).toBeInTheDocument();
  });

  it('does not render a page-number chip', () => {
    render(<SourceCard s={makeSource({ pages: '19' })} {...baseProps} />);
    expect(document.querySelector('.chip')).not.toBeInTheDocument();
  });

  it('shows the updated date in the heading, not the meta row', () => {
    render(<SourceCard s={makeSource({ updated: '2026-07-07' })} {...baseProps} />);
    expect(document.querySelector('.source-header')).toHaveTextContent('updated 2026-07-07');
    expect(document.querySelector('.source-meta-row')).not.toBeInTheDocument();
  });

  it('does not repeat the book title in the citation, since it is already the heading', () => {
    render(<SourceCard s={makeSource({ type: 'book', title: 'The Green Mountain Trail' })} {...baseProps} />);
    expect(document.querySelector('.source-citation')).not.toHaveTextContent('The Green Mountain Trail');
  });

  it('does not repeat the publication year in the book citation, since it is already the heading', () => {
    render(<SourceCard s={makeSource({ type: 'book', year: 1972, publisher: 'GMC Press' })} {...baseProps} />);
    expect(document.querySelector('.source-citation')).not.toHaveTextContent('1972');
  });

  it('does not repeat the magazine title in the citation', () => {
    render(<SourceCard s={makeSource({ type: 'magazine', title: 'Shelter Life', container_title: 'Trail Weekly' })} {...baseProps} />);
    expect(document.querySelector('.source-citation')).not.toHaveTextContent('Shelter Life');
    expect(document.querySelector('.source-citation')).toHaveTextContent('Trail Weekly');
  });

  it('labels the include-in-history toggle "Cite This"', () => {
    render(<SourceCard s={makeSource()} {...baseProps} />);
    expect(screen.getByText('Cite This')).toBeInTheDocument();
  });

  it('renders include_in_history checkbox unchecked when false', () => {
    render(<SourceCard s={makeSource({ include_in_history: false })} {...baseProps} />);
    expect(screen.getByRole('checkbox', { name: /include in history/i })).not.toBeChecked();
  });

  it('renders include_in_history checkbox checked when true', () => {
    render(<SourceCard s={makeSource({ include_in_history: true })} {...baseProps} />);
    expect(screen.getByRole('checkbox', { name: /include in history/i })).toBeChecked();
  });

  it('calls onToggleInclude with the new value when checkbox changes', () => {
    const onToggleInclude = jest.fn();
    render(<SourceCard s={makeSource({ include_in_history: false })} {...baseProps} onToggleInclude={onToggleInclude} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /include in history/i }));
    expect(onToggleInclude).toHaveBeenCalledWith(true);
  });

  it('calls onEdit when the edit button is clicked', () => {
    const onEdit = jest.fn();
    render(<SourceCard s={makeSource()} {...baseProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByTitle('Edit source'));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when the delete button is clicked', () => {
    const onDelete = jest.fn();
    render(<SourceCard s={makeSource()} {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete source'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('shows the annotation when present', () => {
    const s = makeSource({ annotation: 'Key reference for timber framing.' });
    render(<SourceCard s={s} {...baseProps} />);
    expect(screen.getByText('Key reference for timber framing.')).toBeInTheDocument();
  });

  it('omits the annotation block when there is no annotation', () => {
    render(<SourceCard s={makeSource({ annotation: '' })} {...baseProps} />);
    expect(document.querySelector('.source-annotation')).not.toBeInTheDocument();
  });

  it('shows a URL link when url is set', () => {
    render(<SourceCard s={makeSource({ url: 'https://example.com/path' })} {...baseProps} />);
    expect(screen.getByText('example.com')).toBeInTheDocument();
  });

  it('clicking citation link calls openExternal, not browser nav', () => {
    const openExternal = jest.spyOn(window.api.shell, 'openExternal');
    render(<SourceCard s={makeSource({ type: 'journal', url: 'https://example.com' })} {...baseProps} />);
    const link = document.querySelector('.source-citation a') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    fireEvent.click(link);
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining('example.com'));
  });

  it('disables the view button when there is no URL or collection document', () => {
    render(<SourceCard s={makeSource()} {...baseProps} />);
    expect(screen.getByTitle('No document or URL')).toBeDisabled();
  });

  it('opens the browser for a plain URL', () => {
    const openExternal = jest.spyOn(window.api.shell, 'openExternal');
    render(<SourceCard s={makeSource({ url: 'https://example.com' })} {...baseProps} />);
    fireEvent.click(screen.getByTitle('Open in browser'));
    expect(openExternal).toHaveBeenCalledWith('https://example.com');
  });

  it('opens the PDF viewer for a collection document, even when a URL is also set', () => {
    const openPdf = jest.spyOn(window.api.wiki, 'openPdf');
    render(<SourceCard s={makeSource({
      url: 'https://example.com',
      archive_location: 'collections/long-trail-news/1922.pdf',
      pages: '5',
    })} {...baseProps} />);
    fireEvent.click(screen.getByTitle('View PDF'));
    expect(openPdf).toHaveBeenCalledWith('collections/long-trail-news/1922.pdf', 5);
  });

  describe('Clean up quote button', () => {
    it('is absent when the source has no quote', () => {
      render(<SourceCard s={makeSource({ quote: '' })} {...baseProps} />);
      expect(screen.queryByTitle('Clean up quote')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Clean up quote (requires AI API key)')).not.toBeInTheDocument();
    });

    it('is enabled and titled "Clean up quote" when a valid key is configured and not cleaning', () => {
      render(<SourceCard s={makeSource({ quote: 'a messy quote' })} {...baseProps} hasValidApiKey={true} cleaning={false} />);
      const btn = screen.getByTitle('Clean up quote');
      expect(btn).not.toBeDisabled();
    });

    it('is disabled and titled "Clean up quote (requires AI API key)" when no valid key is configured', () => {
      render(<SourceCard s={makeSource({ quote: 'a messy quote' })} {...baseProps} hasValidApiKey={false} cleaning={false} />);
      const btn = screen.getByTitle('Clean up quote (requires AI API key)');
      expect(btn).toBeDisabled();
    });

    it('is disabled with a busy state while cleaning', () => {
      render(<SourceCard s={makeSource({ quote: 'a messy quote' })} {...baseProps} hasValidApiKey={true} cleaning={true} />);
      const btn = screen.getByTitle('Clean up quote');
      expect(btn).toBeDisabled();
    });

    it('calls onCleanUpQuote when clicked', () => {
      const onCleanUpQuote = jest.fn();
      render(<SourceCard s={makeSource({ quote: 'a messy quote' })} {...baseProps} onCleanUpQuote={onCleanUpQuote} />);
      fireEvent.click(screen.getByTitle('Clean up quote'));
      expect(onCleanUpQuote).toHaveBeenCalledTimes(1);
    });
  });
});
