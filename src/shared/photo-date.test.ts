import { getPhotoExifDateValue, normalizePhotoDateTaken } from './photo-date';

describe('photo-date', () => {
  it('normalizes EXIF-style dates to YYYY-MM-DD', () => {
    expect(normalizePhotoDateTaken('2023:05:19 12:00:00')).toBe('2023-05-19');
  });

  it('preserves year-only values', () => {
    expect(normalizePhotoDateTaken('1984')).toBe('1984');
  });

  it('returns an EXIF write value only for full dates', () => {
    expect(getPhotoExifDateValue('1984-09-15')).toBe('1984-09-15');
    expect(getPhotoExifDateValue('1984')).toBeUndefined();
  });
});
