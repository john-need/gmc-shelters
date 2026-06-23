import { fitMapToBounds, makeNumberedIcon, makeDraftIcon, makeEditingIcon, makeOtherShelterIcon } from './markerIcons';
import { mapStub } from '../../../__mocks__/leaflet';
import type { MapMarker } from '../../../../shared/ipc-types';

function makeMarker(overrides: Partial<MapMarker> = {}): MapMarker {
  return {
    id: 1, shelter_id: 10, latitude: 44.1, longitude: -71.6,
    name: 'A', start_year: 1960, end_year: 1975,
    change_type: 'Original', notes: '', is_extant: false,
    photo_id: null, created: '2020-01-01', updated: '2020-01-01',
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('fitMapToBounds', () => {
  it('flyTo default centre at zoom 8 with 0 markers', () => {
    fitMapToBounds(mapStub as never, []);
    expect(mapStub.flyTo).toHaveBeenCalledWith([44.0, -71.5], 8);
  });

  it('flyTo marker coords at zoom 15 with 1 marker', () => {
    fitMapToBounds(mapStub as never, [makeMarker({ latitude: 44.1, longitude: -71.6 })]);
    expect(mapStub.flyTo).toHaveBeenCalledWith([44.1, -71.6], 15);
  });

  it('flyToBounds with maxZoom 15 for 2+ markers', () => {
    fitMapToBounds(mapStub as never, [makeMarker({ id: 1 }), makeMarker({ id: 2 })]);
    expect(mapStub.flyToBounds).toHaveBeenCalledTimes(1);
    expect(mapStub.flyToBounds.mock.calls[0][1].maxZoom).toBe(15);
  });
});

describe('icon factories', () => {
  it('makeNumberedIcon html contains pin number', () => {
    const icon = makeNumberedIcon(3, false, true);
    expect(icon.options.html).toContain('3');
  });

  it('makeNumberedIcon selected -> mm-pin--selected', () => {
    const icon = makeNumberedIcon(1, true, true);
    expect(icon.options.html).toContain('mm-pin--selected');
  });

  it('makeNumberedIcon not-extant -> mm-pin--gone', () => {
    const icon = makeNumberedIcon(1, false, false);
    expect(icon.options.html).toContain('mm-pin--gone');
  });

  it('makeDraftIcon html contains +', () => {
    const icon = makeDraftIcon();
    expect(icon.options.html).toContain('+');
    expect(icon.options.html).toContain('mm-pin--draft');
  });

  it('makeEditingIcon html contains number and editing class', () => {
    const icon = makeEditingIcon(2);
    expect(icon.options.html).toContain('2');
    expect(icon.options.html).toContain('mm-pin--editing');
  });

  it('makeOtherShelterIcon extant has no gone class', () => {
    const icon = makeOtherShelterIcon(true);
    expect(icon.options.html).not.toContain('mm-pin--gone');
  });

  it('makeOtherShelterIcon not-extant has gone class', () => {
    const icon = makeOtherShelterIcon(false);
    expect(icon.options.html).toContain('mm-pin--gone');
  });
});
