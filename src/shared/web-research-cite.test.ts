import { webResultToSource } from './web-research-cite';
import { BLANK_SOURCE } from '../renderer/components/MainPane/tabs/sourceTypes';
import type { WebResearchResult } from './ipc-types';

const RESULT: WebResearchResult = {
  title: 'NOAA Weather Almanac',
  url: 'https://example.com/almanac',
  snippet: 'A primary source describing regional weather patterns.',
  localImagePath: null,
};

describe('webResultToSource', () => {
  it('maps title, url, snippet, and a fixed website type', () => {
    const src = webResultToSource(RESULT);
    expect(src.type).toBe('website');
    expect(src.container_title).toBe('NOAA Weather Almanac');
    expect(src.url).toBe('https://example.com/almanac');
    expect(src.quote).toBe('A primary source describing regional weather patterns.');
  });

  it('sets access_date to today in ISO (YYYY-MM-DD) form', () => {
    const src = webResultToSource(RESULT);
    const today = new Date().toISOString().slice(0, 10);
    expect(src.access_date).toBe(today);
  });

  it('leaves every other Source field at its BLANK_SOURCE default once merged the way the UI merges it', () => {
    const merged = { ...BLANK_SOURCE, ...webResultToSource(RESULT) };
    const { type: _, container_title: __, url: ___, access_date: ____, quote: _____, ...rest } = merged;
    const { type: ______, container_title: _______, url: ________, access_date: _________, quote: __________, ...blankRest } = BLANK_SOURCE;
    expect(rest).toEqual(blankRest);
  });
});
