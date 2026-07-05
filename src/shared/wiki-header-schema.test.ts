import { HEADER_PROPERTIES, HEADER_SCHEMA, SOURCE_TYPES, validateHeader } from './wiki-header-schema';

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
});
