import { HEADER_PROPERTIES, HEADER_SCHEMA, LANGUAGE_OPTIONS, SOURCE_TYPES, validateHeader } from './wiki-header-schema';

describe('wiki-header-schema', () => {
  it('defines an entry for every SourceType, covering every header property', () => {
    expect(SOURCE_TYPES).toHaveLength(12);
    for (const type of SOURCE_TYPES) {
      const row = HEADER_SCHEMA[type];
      expect(row).toBeDefined();
      for (const prop of HEADER_PROPERTIES) {
        expect(['required', 'optional', 'n/a']).toContain(row[prop]);
      }
    }
  });

  it('rejects a citation type that is not a known SourceType', () => {
    const result = validateHeader('not-a-real-type', { title: 'x', description: 'x', language: 'en' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => /citation type/i.test(e))).toBe(true);
  });

  it('rejects when a property required for the citation type is empty', () => {
    // book requires author
    const result = validateHeader('book', { title: 'x', description: 'x', language: 'en', author: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => /author/i.test(e))).toBe(true);
  });

  it('rejects a non-numeric value in a number-control property', () => {
    const result = validateHeader('magazine', {
      title: 'x', description: 'x', language: 'en', publisher: 'GMC', printed_volume: 'not-a-number',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => /printed_volume/i.test(e))).toBe(true);
  });

  it('accepts valid input and drops properties not applicable to the citation type', () => {
    const result = validateHeader('map', {
      title: 'Camel\'s Hump Trail Map',
      description: 'A map.',
      language: 'en',
      volume: '1922', // n/a for map — must be dropped, not error
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fields.title).toBe('Camel\'s Hump Trail Map');
      expect(result.fields.volume).toBeUndefined();
    }
  });

  it('accepts an optional numeric property left blank', () => {
    const result = validateHeader('magazine', {
      title: 'x', description: 'x', language: 'en', publisher: 'GMC', printed_volume: '',
    });
    expect(result.ok).toBe(true);
  });

  it('marks publication_date optional for every citation type', () => {
    for (const type of SOURCE_TYPES) {
      expect(HEADER_SCHEMA[type].publication_date).toBe('optional');
    }
  });

  it('lists English first among the closed language options', () => {
    expect(LANGUAGE_OPTIONS[0]).toEqual({ value: 'en', label: 'English' });
    expect(LANGUAGE_OPTIONS.map((o) => o.value)).toContain('fr');
  });

  it.each([
    ['1996-04-12', true],
    ['1996-04', true],
    ['1996', true],
    ['Spring 1996', true],
    ['Fall 1996', true],
    ['not a date', false],
    ['96', false],
    ['Autumn 1996', false],
  ])('validates publication_date format %s -> %s', (value, valid) => {
    const result = validateHeader('book', {
      title: 'x', description: 'x', language: 'en', author: 'x', publication_date: value,
    });
    expect(result.ok).toBe(valid);
    if (!valid && !result.ok) expect(result.errors.some((e) => /publication_date/i.test(e))).toBe(true);
  });

  it('rejects a language value outside the closed option list', () => {
    const result = validateHeader('book', {
      title: 'x', description: 'x', language: 'de', author: 'x',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => /language/i.test(e))).toBe(true);
  });
});
