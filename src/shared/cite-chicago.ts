import type { Source } from './ipc-types';

// Stub — full Chicago NB formatter is deferred to the data-integration feature.
// When implemented, input is a Source object and output is an HTML string
// with <em> for italics and <a> for URLs (ported from data.js citeChicago()).
export function citeChicago(_source: Source): string {
  return '';
}
