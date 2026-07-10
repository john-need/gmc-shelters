import type { Source } from './ipc-types';
import { syncHistorySourcesSection } from './history-sources';

export function stripSourcesSection(markdown: string): string {
  return syncHistorySourcesSection(markdown, []);
}

export function assembleAcceptedHistory(shelterName: string, narrative: string, citations: Source[]): string {
  const withHeading = `# ${shelterName}\n\n${narrative.trim()}\n`;
  return syncHistorySourcesSection(withHeading, citations);
}
