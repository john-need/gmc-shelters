import { pickWikiResource, type WikiDocRow } from './wiki-resource-match';

// Shapes mirror real search.db rows: newsletters carry volume=year and
// edition=month/season name; guide books carry publication_date=year and
// edition=ordinal number.
const DOCS: WikiDocRow[] = [
  { title: 'Long Trail News', publication_date: '', volume: '1963', edition: 'February', resource: 'collections/Long Trail News/1963_02_Feb.pdf' },
  { title: 'Long Trail News', publication_date: '', volume: '1963', edition: 'August', resource: 'collections/Long Trail News/1963_08_Aug.pdf' },
  { title: 'Long Trail News', publication_date: '', volume: '1995', edition: 'Spring', resource: 'collections/Long Trail News/1995_Spring.pdf' },
  { title: 'Long Trail News', publication_date: '', volume: '1995', edition: 'Fall/Winter', resource: 'collections/Long Trail News/1995_Fall_Winter.pdf' },
  { title: 'Long Trail Guide Book', publication_date: '1977', volume: '', edition: '21', resource: 'collections/Long Trail Guide Books/LongTrailGuide_Ed21_1977.pdf' },
  { title: 'Long Trail Guide Book', publication_date: '1983', volume: '', edition: '22', resource: 'collections/Long Trail Guide Books/LongTrailGuide_Ed22_1983.pdf' },
  { title: 'Smoke and Blazes (Killington)', publication_date: '', volume: '58', edition: '', resource: 'collections/Smoke and Blazes (Killington)/Smoke_and_Blazes_issue_0058.pdf' },
];

describe('pickWikiResource', () => {
  it('links a month-year citation to the matching newsletter issue', () => {
    expect(pickWikiResource(DOCS, { title: 'Long Trail News', date: '1963-08', year: 1963 }))
      .toBe('collections/Long Trail News/1963_08_Aug.pdf');
  });

  it('links a season-year citation to the matching seasonal issue', () => {
    expect(pickWikiResource(DOCS, { title: 'Long Trail News', date: 'Spring 1995', year: 1995 }))
      .toBe('collections/Long Trail News/1995_Spring.pdf');
  });

  it('matches a single season against a combined "Fall/Winter" issue', () => {
    expect(pickWikiResource(DOCS, { title: 'Long Trail News', date: 'Fall 1995', year: 1995 }))
      .toBe('collections/Long Trail News/1995_Fall_Winter.pdf');
  });

  it('returns null for a year-only citation when several issues share that year', () => {
    expect(pickWikiResource(DOCS, { title: 'Long Trail News', year: 1963 })).toBeNull();
  });

  it('links a year-only citation when exactly one document has that year', () => {
    expect(pickWikiResource(DOCS, { title: 'Long Trail Guide Book', year: 1977 }))
      .toBe('collections/Long Trail Guide Books/LongTrailGuide_Ed21_1977.pdf');
  });

  it('links an ordinal edition ("21st") to the numeric edition in the index', () => {
    expect(pickWikiResource(DOCS, { title: 'Long Trail Guide Book', edition: '21st', year: 1977 }))
      .toBe('collections/Long Trail Guide Books/LongTrailGuide_Ed21_1977.pdf');
  });

  it('matches "&" and a missing parenthetical against the indexed collection title', () => {
    expect(pickWikiResource(DOCS, { title: 'Smoke & Blazes', volume: '58' }))
      .toBe('collections/Smoke and Blazes (Killington)/Smoke_and_Blazes_issue_0058.pdf');
  });

  it('matches a cited volume against printed_volume when the index stores the year in volume', () => {
    const docs: WikiDocRow[] = [
      { title: 'Smoke and Blazes (Killington)', publication_date: '', volume: '2004', printed_volume: '57', edition: '', resource: 'collections/S/V57.pdf' },
      { title: 'Smoke and Blazes (Killington)', publication_date: '', volume: '2005', printed_volume: '58', edition: '', resource: 'collections/S/V58.pdf' },
    ];
    expect(pickWikiResource(docs, { title: 'Smoke & Blazes', volume: '58' }))
      .toBe('collections/S/V58.pdf');
  });

  it('returns null when the cited volume matches several issues of the same printed volume', () => {
    const docs: WikiDocRow[] = [
      { title: 'Smoke and Blazes (Killington)', publication_date: '', volume: '2005', printed_volume: '58', edition: '', resource: 'collections/S/V58_N01.pdf' },
      { title: 'Smoke and Blazes (Killington)', publication_date: '', volume: '2005', printed_volume: '58', edition: '', resource: 'collections/S/V58_N03.pdf' },
    ];
    expect(pickWikiResource(docs, { title: 'Smoke & Blazes', volume: '58', year: 2005 })).toBeNull();
  });

  it('returns null when no document title matches', () => {
    expect(pickWikiResource(DOCS, { title: 'Nonexistent Newsletter', year: 1963 })).toBeNull();
  });

  it('returns null when the title matches but nothing narrows to a single document', () => {
    expect(pickWikiResource(DOCS, { title: 'Long Trail News' })).toBeNull();
  });
});
