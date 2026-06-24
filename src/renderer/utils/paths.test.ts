import { buildPhotoUrl } from './paths';

describe('buildPhotoUrl', () => {
  it('builds a URL with no query string when size is omitted', () => {
    const url = buildPhotoUrl('/repo', 'shelters', 'foo/photos/bar.jpg');
    expect(url).toBe('shelter:///repo/shelters/foo/photos/bar.jpg');
  });

  it('appends ?size=grid when size is "grid"', () => {
    const url = buildPhotoUrl('/repo', 'shelters', 'foo/photos/bar.jpg', 'grid');
    expect(url.endsWith('?size=grid')).toBe(true);
  });

  it('appends ?size=preview when size is "preview"', () => {
    const url = buildPhotoUrl('/repo', 'shelters', 'foo/photos/bar.jpg', 'preview');
    expect(url.endsWith('?size=preview')).toBe(true);
  });
});
