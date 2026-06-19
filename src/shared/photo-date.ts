const EXIF_DATE_PREFIX_RE = /^(\d{4}):(\d{2}):(\d{2})(?:[ T].*)?$/;
const FULL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePhotoDateTaken(value: string | null | undefined): string {
  if (!value) return '';

  const trimmed = value.trim();
  const exifMatch = EXIF_DATE_PREFIX_RE.exec(trimmed);
  if (exifMatch) {
    const [, year, month, day] = exifMatch;
    return `${year}-${month}-${day}`;
  }

  return trimmed;
}

export function getPhotoExifDateValue(value: string | null | undefined): string | undefined {
  const normalized = normalizePhotoDateTaken(value);
  return FULL_DATE_RE.test(normalized) ? normalized : undefined;
}
