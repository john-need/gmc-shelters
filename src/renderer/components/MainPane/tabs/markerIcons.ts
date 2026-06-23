import L from 'leaflet';
import type { MapMarker, Shelter } from '../../../../shared/ipc-types';

export function makeNumberedIcon(num: number, selected: boolean, extant: boolean): L.DivIcon {
  const cls = ['mm-pin', selected ? 'mm-pin--selected' : extant ? '' : 'mm-pin--gone']
    .filter(Boolean).join(' ');
  return new L.DivIcon({ className: '', html: `<div class="${cls}">${num}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

export function makeEditingIcon(num: number): L.DivIcon {
  return new L.DivIcon({ className: '', html: `<div class="mm-pin mm-pin--editing">${num}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

export function makeDraftIcon(): L.DivIcon {
  return new L.DivIcon({ className: '', html: `<div class="mm-pin mm-pin--draft">+</div>`, iconSize: [26, 26], iconAnchor: [13, 13] });
}

export function makeOtherShelterIcon(extant: boolean): L.DivIcon {
  const cls = extant ? 'mm-pin mm-pin--other' : 'mm-pin mm-pin--other mm-pin--gone';
  return new L.DivIcon({ className: '', html: `<div class="${cls}"></div>`, iconSize: [18, 18], iconAnchor: [9, 9] });
}

export function fitMapToBounds(map: L.Map, markers: MapMarker[]): void {
  if (markers.length === 0) {
    map.flyTo([44.0, -71.5] as L.LatLngExpression, 8);
    return;
  }
  if (markers.length === 1) {
    map.flyTo([markers[0].latitude, markers[0].longitude] as L.LatLngExpression, 15);
    return;
  }
  const bounds = markers.reduce<L.LatLngBounds>(
    (b, m) => b.extend([m.latitude, m.longitude] as L.LatLngExpression),
    new L.LatLngBounds(
      [markers[0].latitude, markers[0].longitude] as L.LatLngExpression,
      [markers[0].latitude, markers[0].longitude] as L.LatLngExpression,
    ),
  );
  map.flyToBounds(bounds, { maxZoom: 15, padding: [30, 30] as unknown as L.PointExpression });
}

export function renderOtherShelterPins(
  map: L.Map,
  allMarkersByShelter: Record<number, MapMarker[]>,
  allShelters: Shelter[],
  shelterId: number,
  modeRef: React.MutableRefObject<'idle' | 'add' | 'edit'>,
  onSelectShelter: (id: number) => void,
): L.Marker[] {
  const shelterLookup = new Map(allShelters.map((s) => [s.id, s]));
  const pins: L.Marker[] = [];
  Object.entries(allMarkersByShelter).forEach(([sidStr, sMarkers]) => {
    const sid = Number(sidStr);
    if (sid === shelterId) return;
    const s = shelterLookup.get(sid);
    if (!s) return;
    const endDisplay = s.end_year != null ? String(s.end_year) : '--';
    const tooltipHtml = `<strong>${s.name}</strong><br>${s.start_year}–${endDisplay}`;
    sMarkers.forEach((m) => {
      const pin = new L.Marker([m.latitude, m.longitude] as L.LatLngExpression, {
        icon: makeOtherShelterIcon(m.is_extant),
      })
        .addTo(map)
        .bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -10] })
        .on('click', () => { if (modeRef.current === 'idle') onSelectShelter(sid); });
      pins.push(pin);
    });
  });
  return pins;
}
