import { makeArchitecture } from './architecture';
import { makeBuilder } from './builder';
import { makeShelterCategory } from './shelter-category';
import { makePhoto } from './photo';
import { makeMapMarker } from './map-marker';
import { makeSource } from './source';
import { makeShelter } from './shelter';

describe('factories', () => {
  it('makeArchitecture normalizes a null name to empty string', () => {
    expect(makeArchitecture({ id: 1, name: null, description: null, created: 'c', updated: 'u' }))
      .toEqual({ id: 1, name: '', description: null, created: 'c', updated: 'u' });
  });

  it('makeBuilder passes the row through unchanged', () => {
    const row = { id: 1, name: 'GMC', type: 'organization', notes: '', created: 'c', updated: 'u' };
    expect(makeBuilder(row)).toEqual(row);
  });

  it('makeShelterCategory renames category_name to categoryName', () => {
    expect(makeShelterCategory({ id: 1, category_name: 'Lean To', description: null, created: 'c', updated: 'u' }))
      .toEqual({ id: 1, categoryName: 'Lean To', description: null, created: 'c', updated: 'u' });
  });

  it('makePhoto coerces include_in_post to boolean and camelCases fields', () => {
    const photo = makePhoto({
      id: 1, photographer: null, file_name: 'a.jpg', caption: null, date_taken: null, notes: null,
      created: 'c', updated: 'u', shelter_id: 7, alt_text: null, title: null, description: null,
      include_in_post: 1, sort_order: 2,
    });
    expect(photo.fileName).toBe('a.jpg');
    expect(photo.shelterId).toBe(7);
    expect(photo.includeInPost).toBe(true);
    expect(photo.sortOrder).toBe(2);
  });

  it('makeMapMarker coerces is_extant to boolean and camelCases fields', () => {
    const marker = makeMapMarker({
      id: 1, shelter_id: 7, latitude: 44, longitude: -72.9, name: '', start_year: 1930,
      end_year: null, change_type: 'Original', notes: '', is_extant: 0, photo_id: null,
      created: 'c', updated: 'u',
    });
    expect(marker.shelterId).toBe(7);
    expect(marker.startYear).toBe(1930);
    expect(marker.isExtant).toBe(false);
  });

  it('makeSource camelCases every bibliographic field', () => {
    const source = makeSource({
      id: 1, type: 'book', author: 'Smith', title: 'T', container_title: '', container_author: '',
      editor: '', edition: '', volume: '', issue: '', pages: '', publisher: '', place: '',
      year: 1963, date: '', url: '', access_date: '', archive: '', archive_location: '',
      created: 'c', updated: 'u',
    });
    expect(source.containerTitle).toBe('');
    expect(source.accessDate).toBe('');
    expect(source.archiveLocation).toBe('');
  });

  it('makeShelter composes the raw row with pre-normalized relations', () => {
    const architecture = { id: 1, name: 'Log Cabin', description: '', created: 'c', updated: 'u' };
    const builder = { id: 1, name: 'GMC', type: 'organization', notes: '', created: 'c', updated: 'u' };
    const category = { id: 1, categoryName: 'Lean To', description: null, created: 'c', updated: 'u' };

    const shelter = makeShelter(
      {
        id: 7, name: 'Birch Glen', start_year: 1932, end_year: null, description: null,
        slug: 'birch-glen', default_photo_id: null, is_gmc: 1, notes: null,
        created: 'c', updated: 'u', show_on_web: 1, history: null,
      },
      { architecture, builder, category, photos: [], sources: [], mapMarkers: [] },
    );

    expect(shelter.startYear).toBe(1932);
    expect(shelter.isGMC).toBe(true);
    expect(shelter.showOnWeb).toBe(true);
    expect(shelter.architecture).toBe(architecture);
    expect(shelter.photos).toEqual([]);
  });

  it('makeShelter accepts null architecture/builder/category for unassigned relations', () => {
    const shelter = makeShelter(
      {
        id: 8, name: 'Unnamed Camp', start_year: 1940, end_year: null, description: null,
        slug: 'unnamed-camp', default_photo_id: null, is_gmc: 0, notes: null,
        created: 'c', updated: 'u', show_on_web: 0, history: null,
      },
      { architecture: null, builder: null, category: null, photos: [], sources: [], mapMarkers: [] },
    );

    expect(shelter.architecture).toBeNull();
    expect(shelter.builder).toBeNull();
    expect(shelter.category).toBeNull();
  });
});
