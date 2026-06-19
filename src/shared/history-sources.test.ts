import type { Source } from './ipc-types';
import { syncHistorySourcesSection } from './history-sources';

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    shelter_id: 7,
    include_in_history: false,
    type: 'book',
    author: 'Doe, Jane',
    title: 'Shelter Notes',
    container_title: '',
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

describe('history sources sync', () => {
  it('adds a ### Sources section to the end for included sources', () => {
    const markdown = '# Birch Glen Lodge\n';

    expect(
      syncHistorySourcesSection(markdown, [source({ include_in_history: true })]),
    ).toBe('# Birch Glen Lodge\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n');
  });

  it('removes the sources section when no sources are included', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n';

    expect(syncHistorySourcesSection(markdown, [source({ include_in_history: false })])).toBe(
      '# Birch Glen Lodge\n',
    );
  });

  it('replaces an existing ## Sources section with ### Sources markdown citations', () => {
    const markdown = '# Birch Glen Lodge\n\nBody copy.\n\n## Sources\n\n- old line\n';

    expect(
      syncHistorySourcesSection(markdown, [source({ include_in_history: true })]),
    ).toBe('# Birch Glen Lodge\n\nBody copy.\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n');
  });

  it('does not duplicate sources when rebuilt repeatedly', () => {
    const once = syncHistorySourcesSection('# Birch Glen Lodge\n', [
      source({ include_in_history: true }),
    ]);

    const twice = syncHistorySourcesSection(once, [
      source({ include_in_history: true }),
    ]);

    expect(twice).toBe(once);
  });

  it('removes an unchecked source from an existing sources section', () => {
    const withTwo = syncHistorySourcesSection('# Birch Glen Lodge\n', [
      source({ id: 1, include_in_history: true, author: 'Doe, Jane', title: 'First Book' }),
      source({ id: 2, include_in_history: true, author: 'Smith, John', title: 'Second Book' }),
    ]);

    const rebuilt = syncHistorySourcesSection(withTwo, [
      source({ id: 1, include_in_history: false, author: 'Doe, Jane', title: 'First Book' }),
      source({ id: 2, include_in_history: true, author: 'Smith, John', title: 'Second Book' }),
    ]);

    expect(rebuilt).toBe('# Birch Glen Lodge\n\n### Sources\n\n- Smith, John. *Second Book*.\n');
  });
});
