import type { Source } from './ipc-types';
import { stripSourcesSection, assembleAcceptedHistory } from './generate-history';

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    shelter_id: 7,
    include_in_history: true,
    type: 'book',
    author: 'Doe, Jane',
    title: 'Shelter Notes',
    container_title: '', container_author: '',
    editor: '',
    edition: '',
    volume: '',
    issue: '',
    pages: '',
    publisher: '',
    place: '',
    year: null,
    date: '',
    url: '',
    access_date: '',
    archive: '',
    archive_location: '',
    annotation: '',
    notes: '',
    quote: '',
    created: '2020-01-01',
    updated: '2020-01-02',
    ...overrides,
  };
}

describe('stripSourcesSection', () => {
  it('removes an existing ### Sources section', () => {
    const markdown = '# Birch Glen Lodge\n\nBody copy.\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n';
    expect(stripSourcesSection(markdown)).toBe('# Birch Glen Lodge\n\nBody copy.\n');
  });

  it('leaves prose unchanged when there is no Sources section to remove', () => {
    const markdown = '# Birch Glen Lodge\n\nBody copy with no sources section.\n';
    expect(stripSourcesSection(markdown)).toBe(markdown);
  });
});

describe('assembleAcceptedHistory', () => {
  it('produces a heading, the trimmed narrative, and a reattached Sources section', () => {
    const result = assembleAcceptedHistory('Birch Glen Lodge', '  Body copy.  \n\n', [
      source({ include_in_history: true }),
    ]);

    expect(result).toBe('# Birch Glen Lodge\n\nBody copy.\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n');
  });

  it('omits the Sources section entirely when no citations are included', () => {
    const result = assembleAcceptedHistory('Birch Glen Lodge', 'Body copy.', []);
    expect(result).toBe('# Birch Glen Lodge\n\nBody copy.\n');
  });
});
