import type { Source } from './ipc-types';
import { citeChicagoMarkdown } from './cite-chicago';

function normalizeTrailingWhitespace(markdown: string): string {
  return markdown.replace(/\s+$/, '');
}

function isSourcesHeading(line: string): boolean {
  return /^#{2,3}\s+Sources\s*$/.test(line.trimEnd());
}

function isHeading(line: string): boolean {
  return /^#{1,3}\s+/.test(line.trimStart());
}

function splitAroundSourcesSection(markdown: string): { before: string; after: string; found: boolean } {
  if (!markdown) {
    return { before: '', after: '', found: false };
  }

  const lines = markdown.split('\n');
  const start = lines.findIndex(isSourcesHeading);

  if (start === -1) {
    return { before: markdown, after: '', found: false };
  }

  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isHeading(lines[i])) {
      end = i;
      break;
    }
  }

  const before = lines.slice(0, start).join('\n').replace(/\n+$/, '');
  const after = lines.slice(end).join('\n').replace(/^\n+/, '');
  return { before, after, found: true };
}

function sortSources(sources: Source[]): Source[] {
  return [...sources].sort((a, b) => {
    const authorCompare = (a.author || '').localeCompare(b.author || '');
    if (authorCompare !== 0) return authorCompare;

    const yearCompare = (a.year ?? 0) - (b.year ?? 0);
    if (yearCompare !== 0) return yearCompare;

    return (a.title || '').localeCompare(b.title || '');
  });
}

export function buildHistorySourcesSection(sources: Source[]): string {
  const included = sortSources(sources)
    .filter((source) => source.include_in_history)
    .map((source) => `- ${citeChicagoMarkdown(source)}`.trimEnd())
    .filter((line) => line !== '-');

  if (included.length === 0) {
    return '';
  }

  return `### Sources\n\n${included.join('\n')}`;
}

export function syncHistorySourcesSection(markdown: string, sources: Source[]): string {
  const section = buildHistorySourcesSection(sources);
  const trimmed = normalizeTrailingWhitespace(markdown);
  const { before, after, found } = splitAroundSourcesSection(trimmed);

  if (!section) {
    const remaining = [before, after].filter(Boolean).join('\n\n');
    return remaining ? `${remaining}\n` : '';
  }

  if (!trimmed || !found) {
    if (!trimmed) {
      return `${section}\n`;
    }

    return `${trimmed}\n\n${section}\n`;
  }

  const rebuilt = [before, section, after].filter(Boolean).join('\n\n');
  if (!rebuilt) {
    return `${section}\n`;
  }

  return `${rebuilt}\n`;
}
