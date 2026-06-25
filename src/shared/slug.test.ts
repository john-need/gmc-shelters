import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Birch Glen Shelter')).toBe('birch-glen-shelter');
  });

  it('collapses runs of non-alphanumeric chars into one hyphen', () => {
    expect(slugify('My  Shelter!!Two')).toBe('my-shelter-two');
  });

  it('strips leading/trailing hyphens', () => {
    expect(slugify('--Edge--')).toBe('edge');
  });

  it('strips path separators and traversal sequences', () => {
    expect(slugify('My Shelter/Two')).toBe('my-shelter-two');
    expect(slugify('../etc/passwd')).toBe('etc-passwd');
  });

  it('returns empty string for all-symbol input', () => {
    expect(slugify('!!!')).toBe('');
    expect(slugify('   ')).toBe('');
  });
});
