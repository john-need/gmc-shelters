import type { Source } from './ipc-types';
import { syncHistorySourcesSection, parseHistorySourcesSection } from './history-sources';

function source(overrides: Partial<Source> = {}): Source {
  return {
    id: 1,
    shelter_id: 7,
    include_in_history: false,
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

describe('parseHistorySourcesSection', () => {
  it('returns an empty array when there is no ### Sources heading', () => {
    expect(parseHistorySourcesSection('# Birch Glen Lodge\n\nSome body text.\n')).toEqual([]);
  });

  it('returns an empty array when the Sources section has no bullets', () => {
    expect(parseHistorySourcesSection('# Birch Glen Lodge\n\n### Sources\n')).toEqual([]);
  });

  it('parses a minimal book-style citation (italic title only, no quotes)', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n';
    expect(parseHistorySourcesSection(markdown)).toEqual([
      {
        type: 'book',
        author: 'Doe, Jane',
        title: 'Shelter Notes',
        container_title: '',
        year: null,
        pages: '',
        edition: '',
        volume: '',
        publisher: '',
        url: '',
        annotation: '',
      },
    ]);
  });

  it('extracts publisher and pages from a rendered book citation instead of dumping them in annotation', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n'
      + '- Doe, Jane. *Shelter Notes*. **Green Mountain Club**, 1932. Pp. 12-14.\n';
    const [parsed] = parseHistorySourcesSection(markdown);
    expect(parsed).toMatchObject({
      type: 'book',
      author: 'Doe, Jane',
      title: 'Shelter Notes',
      year: 1932,
      publisher: 'Green Mountain Club',
      pages: '12-14',
    });
  });

  it('parses a journal-style citation: quoted title, italic container, year, and a trailing link', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n'
      + '- Doe, Jane. “Trail Conditions Report.” *Long Trail News* 45, no. 3 (1999): 12-14. '
      + '[https://example.com/article](https://example.com/article).\n';
    const [parsed] = parseHistorySourcesSection(markdown);
    expect(parsed).toMatchObject({
      type: 'journal',
      author: 'Doe, Jane',
      title: 'Trail Conditions Report',
      container_title: 'Long Trail News',
      year: 1999,
      url: 'https://example.com/article',
    });
  });

  it('parses a website-style citation: quoted title, url, no italic container', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n'
      + '- Smith, Al. “Trail Report.” VT News. Last modified May 1, 2020. '
      + '[https://example.com](https://example.com).\n';
    const [parsed] = parseHistorySourcesSection(markdown);
    expect(parsed).toMatchObject({
      type: 'website',
      author: 'Smith, Al',
      title: 'Trail Report',
      url: 'https://example.com',
      publisher: 'VT News',
    });
  });

  describe('re-parses its own rendered output without losing fields (Replace Sources run twice must not degrade)', () => {
    function render(overrides: Partial<Source>): string {
      return syncHistorySourcesSection('# Birch Glen Lodge\n', [source({ include_in_history: true, ...overrides })]);
    }

    it('round-trips a full magazine citation: quoted title, italic container, publisher, pages', () => {
      const markdown = render({
        type: 'magazine', author: '', title: 'Little Rock Pond Shelter Dedicated to Lula M. Tye',
        container_title: 'Long Trail News', year: 1963, pages: '4-5', publisher: 'Green Mountain Club',
      });
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed).toMatchObject({
        type: 'magazine',
        title: 'Little Rock Pond Shelter Dedicated to Lula M. Tye',
        container_title: 'Long Trail News',
        year: 1963,
        pages: '4-5',
        publisher: 'Green Mountain Club',
      });
    });

    it('round-trips a book citation with edition, bolded publisher, and pages', () => {
      const markdown = render({
        type: 'book', author: '', title: 'Long Trail Guide Book', container_title: '',
        edition: '21st', year: 1977, pages: '38', publisher: 'Green Mountain Club',
      });
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed).toMatchObject({
        type: 'book',
        title: 'Long Trail Guide Book',
        edition: '21st',
        year: 1977,
        pages: '38',
        publisher: 'Green Mountain Club',
      });
    });

    it('round-trips a magazine citation with a volume number after the italic container', () => {
      const markdown = render({
        type: 'magazine', author: '', title: 'Trivia item on Lula Tye Shelter',
        container_title: 'Smoke & Blazes', volume: '58', year: 2005, publisher: 'Killington Section, GMC',
      });
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed).toMatchObject({
        type: 'magazine',
        title: 'Trivia item on Lula Tye Shelter',
        container_title: 'Smoke & Blazes',
        volume: '58',
        year: 2005,
        publisher: 'Killington Section, GMC',
      });
    });

    it('keeps a titleless magazine citation a magazine (italic followed by a comma is a periodical, not a book title)', () => {
      const markdown = render({
        type: 'magazine', author: '', title: '', container_title: 'Long Trail News',
        year: 1972, publisher: 'Green Mountain Club',
      });
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed).toMatchObject({
        type: 'magazine',
        title: '',
        container_title: 'Long Trail News',
        year: 1972,
        publisher: 'Green Mountain Club',
      });
    });
  });

  it('falls back to type "other" and dumps the whole line into annotation when it has no title markup at all', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n- A hand-typed note with no markdown.\n';
    expect(parseHistorySourcesSection(markdown)).toEqual([
      {
        type: 'other',
        author: '',
        title: '',
        container_title: '',
        year: null,
        url: '',
        annotation: 'A hand-typed note with no markdown.',
      },
    ]);
  });

  it('parses every bullet in the section, in order', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n'
      + '- Doe, Jane. *First Book*.\n'
      + '- Smith, John. *Second Book*.\n';
    const parsed = parseHistorySourcesSection(markdown);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].title).toBe('First Book');
    expect(parsed[1].title).toBe('Second Book');
  });

  it('stops at the next heading and ignores content after the Sources section', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\n- Doe, Jane. *First Book*.\n\n## Appendix\n\n- Not a source\n';
    const parsed = parseHistorySourcesSection(markdown);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe('First Book');
  });

  it('accepts plain, non-dashed lines under ### Sources (not every history file was synced by this app)', () => {
    const markdown = '# Lula Tye Shelter\n\n### Sources\n'
      + 'GMC Shelter Database, Shelter ID 000156. Green Mountain Club.\n'
      + 'A hand-typed note with no recognizable author or collection.\n';
    const parsed = parseHistorySourcesSection(markdown);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].annotation).toBe('GMC Shelter Database, Shelter ID 000156. Green Mountain Club.');
    expect(parsed[1].annotation).toBe('A hand-typed note with no recognizable author or collection.');
  });

  describe('recognizing a known collection name in a plain pasted citation', () => {
    const LTN = { name: 'Long Trail News', citationType: 'magazine' };

    it('parses "Collection, Month Year, p. Pages. "Title." Publisher." with no author', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail News, August 1963, p. 4–5. "Little Rock Pond Shelter Dedicated to Lula M. Tye." Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [LTN]);
      expect(parsed).toEqual({
        type: 'magazine',
        container_title: 'Long Trail News',
        author: '',
        title: 'Little Rock Pond Shelter Dedicated to Lula M. Tye',
        year: 1963,
        date: '1963-08',
        pages: '4-5',
        edition: '',
        volume: '',
        publisher: 'Green Mountain Club',
        annotation: '',
        url: '',
      });
    });

    it('recognizes an optional author sitting between the pages and the quoted title', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail News, February 1974, p. 5. George F. Pearlstein, "Trail and Shelter Changes." Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [LTN]);
      expect(parsed).toMatchObject({
        type: 'magazine',
        container_title: 'Long Trail News',
        author: 'George F. Pearlstein',
        title: 'Trail and Shelter Changes',
        date: '1974-02',
        pages: '5',
        publisher: 'Green Mountain Club',
      });
    });

    it('stores a "Season Year" date verbatim (already a valid freeform date) instead of converting it', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail News, Spring 1995. "Lula Tye served as Corresponding Secretary of the GMC from 1926–1955." Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [LTN]);
      expect(parsed).toMatchObject({
        container_title: 'Long Trail News',
        date: 'Spring 1995',
        year: 1995,
        title: 'Lula Tye served as Corresponding Secretary of the GMC from 1926–1955',
        publisher: 'Green Mountain Club',
      });
    });

    it('falls back to collection recognition without title/author/pages when there is no quoted title', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\nLong Trail News, November 1972. Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [LTN]);
      expect(parsed).toMatchObject({
        type: 'magazine',
        container_title: 'Long Trail News',
        date: '1972-11',
      });
      expect(parsed.annotation).toContain('Green Mountain Club');
    });

    it('puts a document-titled collection\'s name in `title` (not `container_title`) when there is no quoted title, since citeChicagoMarkdown\'s book formatter only reads `title`', () => {
      const GUIDE_BOOK = { name: 'Long Trail Guide Book', citationType: 'book' };
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail Guide Book, 21st ed. Green Mountain Club, 1977. P. 38.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [GUIDE_BOOK]);
      expect(parsed).toMatchObject({
        type: 'book',
        title: 'Long Trail Guide Book',
        container_title: '',
        year: 1977,
      });
    });

    it('also extracts pages and edition when there is no quoted title (not just when there is one)', () => {
      const GUIDE_BOOK = { name: 'Long Trail Guide Book', citationType: 'book' };
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail Guide Book, 21st ed. Green Mountain Club, 1977. P. 38.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [GUIDE_BOOK]);
      expect(parsed).toMatchObject({
        edition: '21st',
        pages: '38',
        publisher: 'Green Mountain Club',
      });
    });

    it('matches a cited name with "&" and a different parenthetical against a collection named with "and", extracting Vol., year, unquoted title, and publisher', () => {
      const SMOKE = { name: 'Smoke and Blazes (Killington)', citationType: 'magazine' };
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Smoke & Blazes (Killington Section), Vol. 58 (2005). Trivia item on Lula Tye Shelter. Killington Section, GMC.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [SMOKE]);
      expect(parsed).toMatchObject({
        type: 'magazine',
        container_title: 'Smoke & Blazes',
        volume: '58',
        year: 2005,
        title: 'Trivia item on Lula Tye Shelter',
        publisher: 'Killington Section, GMC',
      });
    });

    it('matches a cited name whose parenthetical differs from the collection\'s ("Ridgelines (Burlington Section)" vs "Ridgelines (Burlington)")', () => {
      const RIDGELINES = { name: 'Ridgelines (Burlington)', citationType: 'magazine' };
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Ridgelines (Burlington Section), Fall 2005, p. 2. "A Conversation with Caretakers Annaliese and Kelly." Burlington Section, GMC.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [RIDGELINES]);
      expect(parsed).toMatchObject({
        type: 'magazine',
        container_title: 'Ridgelines',
        title: 'A Conversation with Caretakers Annaliese and Kelly',
        date: 'Fall 2005',
        pages: '2',
        publisher: 'Burlington Section, GMC',
      });
    });

    it('treats an unquoted middle sentence as the article title when a publisher sentence follows it', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail News, Summer 2021. Sandy Stare obituary. Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [LTN]);
      expect(parsed).toMatchObject({
        type: 'magazine',
        container_title: 'Long Trail News',
        title: 'Sandy Stare obituary',
        date: 'Summer 2021',
        year: 2021,
        publisher: 'Green Mountain Club',
      });
    });

    it('matches against the collection\'s authored citation title when it differs from the folder name ("Long Trail Guide Books" folder, cited as "Long Trail Guide Book")', () => {
      const GUIDE_BOOKS = {
        name: 'Long Trail Guide Books',
        citationType: 'book',
        defaults: { title: 'Long Trail Guide Book' },
      };
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail Guide Book, 21st ed. Green Mountain Club, 1977. P. 38.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [GUIDE_BOOKS]);
      expect(parsed).toMatchObject({
        type: 'book',
        title: 'Long Trail Guide Book',
        edition: '21st',
        pages: '38',
        year: 1977,
        publisher: 'Green Mountain Club',
      });
    });

    it('does not match "Trail Talk (Montpelier)" against a line citing "The Trail Talk", and vice versa', () => {
      const collections = [
        { name: 'The Trail Talk (Connecticut)', citationType: 'magazine' },
        { name: 'Trail Talk (Montpelier)', citationType: 'magazine' },
      ];
      const markdown = '# Shelter\n\n### Sources\n\n'
        + 'The Trail Talk, Spring 1970. Green Mountain Club.\n'
        + 'Trail Talk (Montpelier Section), Fall 1980. Green Mountain Club.\n';
      const parsed = parseHistorySourcesSection(markdown, collections);
      expect(parsed[0].container_title).toBe('The Trail Talk');
      expect(parsed[0].date).toBe('Spring 1970');
      expect(parsed[1].container_title).toBe('Trail Talk');
      expect(parsed[1].date).toBe('Fall 1980');
    });

    it('does not leak trailing unrelated prose into publisher when text follows the year (no title to bound it)', () => {
      const GUIDE_BOOK = { name: 'Long Trail Guide Book', citationType: 'book' };
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Long Trail Guide Book, 24th ed. Green Mountain Club, 1996. Green Mountain National Forest section.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [GUIDE_BOOK]);
      expect(parsed.publisher).toBe('Green Mountain Club');
    });

    it('does not apply collection parsing when the line does not start with a known collection name', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\nGMC Shelter Database, Shelter ID 000156. Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [LTN]);
      expect(parsed.type).toBe('other');
      expect(parsed.annotation).toBe('GMC Shelter Database, Shelter ID 000156. Green Mountain Club.');
    });

    it('falls back to type "magazine" when the collection has no authored citationType', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\nLong Trail News, August 1963. "A Title." Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [{ name: 'Long Trail News', citationType: null }]);
      expect(parsed.type).toBe('magazine');
    });

    it('still uses the existing markdown-marker parsing when the line has markup, ignoring collection matching', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n- Doe, Jane. *Shelter Notes*.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [LTN]);
      expect(parsed).toMatchObject({ type: 'book', author: 'Doe, Jane', title: 'Shelter Notes' });
    });
  });

  describe('recognizing an author-first book citation with no known collection match', () => {
    it('parses "Author. Title, Nth ed. Publisher, Year." into structured fields', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Woodward, Paul and Joanne. Long Trail System Shelter History, 2nd ed. Green Mountain Club, 1999.\n';
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed).toMatchObject({
        type: 'book',
        author: 'Woodward, Paul and Joanne',
        title: 'Long Trail System Shelter History',
        edition: '2nd',
        publisher: 'Green Mountain Club',
        year: 1999,
      });
    });

    it('does not misfire on a line whose leading segment contains a digit (not a real author name)', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'GMC Shelter Database, Shelter ID 000156. Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed.type).toBe('other');
      expect(parsed.annotation).toBe('GMC Shelter Database, Shelter ID 000156. Green Mountain Club.');
    });

    it('does not misfire on a line with no comma in its leading segment', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\nSome plain sentence without a name up front.\n';
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed.type).toBe('other');
    });

    it('does not misfire on "Vol." as a false sentence break (a collection name with a volume number, not an author)', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\n'
        + 'Smoke & Blazes (Killington Section), Vol. 58 (2005). Trivia item on Lula Tye Shelter. Killington Section, GMC.\n';
      const [parsed] = parseHistorySourcesSection(markdown);
      expect(parsed.type).toBe('other');
      expect(parsed.annotation).toContain('Smoke & Blazes');
    });

    it('a known collection match still takes priority over the author-first heuristic', () => {
      const markdown = '# Lula Tye Shelter\n\n### Sources\n\nLong Trail News, November 1972. Green Mountain Club.\n';
      const [parsed] = parseHistorySourcesSection(markdown, [{ name: 'Long Trail News', citationType: 'magazine' }]);
      expect(parsed.type).toBe('magazine');
      expect(parsed.container_title).toBe('Long Trail News');
    });
  });

  it('skips blank lines under ### Sources when mixed with plain citation lines', () => {
    const markdown = '# Birch Glen Lodge\n\n### Sources\n\nA plain citation line.\n\nAnother one.\n';
    const parsed = parseHistorySourcesSection(markdown);
    expect(parsed).toHaveLength(2);
  });

  it('round-trips a full generated Sources section back to equivalent parsed fields', () => {
    const original: Source[] = [
      {
        id: 1, shelter_id: 7, include_in_history: true, type: 'book',
        author: 'Doe, Jane', title: 'Shelter Notes', container_title: '', container_author: '',
        editor: '', edition: '', volume: '', issue: '', pages: '', publisher: '', place: '',
        year: 1932, date: '', url: '', access_date: '', archive: '', archive_location: '',
        annotation: '', notes: '', quote: '', created: '2020-01-01', updated: '2020-01-02',
      },
    ];
    const markdown = syncHistorySourcesSection('# Birch Glen Lodge\n', original);
    const parsed = parseHistorySourcesSection(markdown);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].author).toBe('Doe, Jane');
    expect(parsed[0].title).toBe('Shelter Notes');
    expect(parsed[0].year).toBe(1932);
  });
});
