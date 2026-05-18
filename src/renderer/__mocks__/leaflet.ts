// Stub for Leaflet 2.0 in Jest/jsdom — the real library requires a browser layout engine.
// Leaflet 2.0 removed lowercase factory fns; component now uses `new L.Map()`, `new L.Marker()`, etc.

function makeMarkerStub() {
  const stub: any = {
    addTo: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    remove: jest.fn(),
    setIcon: jest.fn(),
    getLatLng: jest.fn(() => ({ lat: 44.0, lng: -71.5 })),
  };
  return stub;
}

const mapStub = {
  on: jest.fn(),
  off: jest.fn(),
  remove: jest.fn(),
  getContainer: jest.fn(() => ({ style: {} as CSSStyleDeclaration })),
};

const L = {
  Map: jest.fn(() => mapStub),
  TileLayer: jest.fn(() => ({ addTo: jest.fn() })),
  DivIcon: jest.fn(() => ({})),
  Marker: jest.fn(() => makeMarkerStub()),
};

export default L;
export const { Map, TileLayer, DivIcon, Marker } = L;
