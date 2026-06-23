import { showSourceField, containerTitleLabel, prettyUrl } from './sourceTypes';

describe('showSourceField', () => {
  it('author is shown for every type', () => {
    expect(showSourceField('author', 'book', false)).toBe(true);
    expect(showSourceField('author', 'website', false)).toBe(true);
    expect(showSourceField('author', 'interview', false)).toBe(true);
  });

  it('container_title shown for journal but not for book', () => {
    expect(showSourceField('container_title', 'journal', false)).toBe(true);
    expect(showSourceField('container_title', 'book', false)).toBe(false);
  });

  it('archive_location shown only for archive/manuscript/interview', () => {
    expect(showSourceField('archive_location', 'archive', false)).toBe(true);
    expect(showSourceField('archive_location', 'manuscript', false)).toBe(true);
    expect(showSourceField('archive_location', 'interview', false)).toBe(true);
    expect(showSourceField('archive_location', 'book', false)).toBe(false);
  });

  it('access_date shown for website and when hasUrl is true', () => {
    expect(showSourceField('access_date', 'website', false)).toBe(true);
    expect(showSourceField('access_date', 'book', true)).toBe(true);
    expect(showSourceField('access_date', 'book', false)).toBe(false);
  });

  it('unknown key returns false', () => {
    expect(showSourceField('nonexistent_key', 'book', false)).toBe(false);
  });
});

describe('containerTitleLabel', () => {
  it('returns "Journal / magazine" for journal and magazine', () => {
    expect(containerTitleLabel('journal')).toBe('Journal / magazine');
    expect(containerTitleLabel('magazine')).toBe('Journal / magazine');
  });

  it('returns type-specific labels', () => {
    expect(containerTitleLabel('newspaper')).toBe('Newspaper');
    expect(containerTitleLabel('website')).toBe('Website name');
    expect(containerTitleLabel('archive')).toBe('Collection');
  });

  it('falls back to "Container title" for other types', () => {
    expect(containerTitleLabel('book')).toBe('Container title');
    expect(containerTitleLabel(undefined)).toBe('Container title');
  });
});

describe('prettyUrl', () => {
  it('extracts hostname without www', () => {
    expect(prettyUrl('https://www.example.com/path')).toBe('example.com');
  });

  it('returns the original string for invalid URLs', () => {
    expect(prettyUrl('not a url')).toBe('not a url');
  });
});
