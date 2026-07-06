import type { SourceType } from './ipc-types';

export const SOURCE_TYPES: SourceType[] = [
  'book', 'chapter', 'journal', 'newspaper', 'magazine', 'website',
  'archive', 'manuscript', 'interview', 'map', 'report', 'other',
];

export type HeaderControl = 'text' | 'multiline' | 'number' | 'select';
export type FieldApplicability = 'required' | 'optional' | 'n/a';

export const HEADER_PROPERTIES = [
  'title', 'description', 'language', 'author', 'publisher', 'edition',
  'volume', 'printed_volume', 'printed_issue',
] as const;
export type HeaderProperty = (typeof HEADER_PROPERTIES)[number];

// Properties a collection can set a shared default for. Excludes edition/volume/
// printed_volume/printed_issue — those are unique per document (e.g. each issue
// of a newsletter has its own volume/issue number), never collection-wide.
export const COLLECTION_DEFAULT_PROPERTIES = [
  'title', 'description', 'language', 'author', 'publisher',
] as const;
export type CollectionDefaultProperty = (typeof COLLECTION_DEFAULT_PROPERTIES)[number];

export const HEADER_PROPERTY_CONTROL: Record<HeaderProperty, HeaderControl> = {
  title: 'text',
  description: 'multiline',
  language: 'text',
  author: 'text',
  publisher: 'text',
  edition: 'text',
  volume: 'text',
  printed_volume: 'number',
  printed_issue: 'number',
};

// Per data-model.md's Header Schema Table.
export const HEADER_SCHEMA: Record<SourceType, Record<HeaderProperty, FieldApplicability>> = {
  book: {
    title: 'required', description: 'required', language: 'required', author: 'required',
    publisher: 'optional', edition: 'optional', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
  chapter: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'optional', edition: 'optional', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
  journal: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'required', edition: 'optional', volume: 'optional', printed_volume: 'optional', printed_issue: 'optional',
  },
  newspaper: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'required', edition: 'optional', volume: 'optional', printed_volume: 'optional', printed_issue: 'optional',
  },
  magazine: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'required', edition: 'optional', volume: 'optional', printed_volume: 'optional', printed_issue: 'optional',
  },
  website: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'optional', edition: 'n/a', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
  archive: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'optional', edition: 'n/a', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
  manuscript: {
    title: 'required', description: 'required', language: 'required', author: 'required',
    publisher: 'n/a', edition: 'n/a', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
  interview: {
    title: 'required', description: 'required', language: 'required', author: 'required',
    publisher: 'n/a', edition: 'n/a', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
  map: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'optional', edition: 'n/a', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
  report: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'required', edition: 'optional', volume: 'optional', printed_volume: 'optional', printed_issue: 'optional',
  },
  other: {
    title: 'required', description: 'required', language: 'required', author: 'optional',
    publisher: 'optional', edition: 'optional', volume: 'n/a', printed_volume: 'n/a', printed_issue: 'n/a',
  },
};

function isKnownSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as string[]).includes(value);
}

export type ValidateHeaderResult =
  | { ok: true; fields: Record<string, string> }
  | { ok: false; errors: string[] };

/**
 * Validates raw field values against the Header Schema for citationType, and
 * drops any property the schema marks `n/a` for that type — a stale value
 * left over from a previously selected citation type never reaches the file.
 */
export function validateHeader(citationType: string, fields: Record<string, string>): ValidateHeaderResult {
  if (!isKnownSourceType(citationType)) {
    return { ok: false, errors: [`"${citationType}" is not a recognized citation type.`] };
  }

  const schema = HEADER_SCHEMA[citationType];
  const errors: string[] = [];
  const result: Record<string, string> = {};

  for (const prop of HEADER_PROPERTIES) {
    const applicability = schema[prop];
    if (applicability === 'n/a') continue;

    const value = fields[prop]?.trim() ?? '';
    if (applicability === 'required' && !value) {
      errors.push(`"${prop}" is required for citation type "${citationType}".`);
      continue;
    }
    if (value && HEADER_PROPERTY_CONTROL[prop] === 'number' && !/^\d+$/.test(value)) {
      errors.push(`"${prop}" must be a number.`);
      continue;
    }
    result[prop] = fields[prop] ?? '';
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, fields: result };
}
