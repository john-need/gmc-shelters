import { screenToLocalDelta } from './cropUtils';

const round = (v: { dx: number; dy: number }) => ({
  dx: Math.round(v.dx * 1e10) / 1e10 || 0,
  dy: Math.round(v.dy * 1e10) / 1e10 || 0,
});

describe('screenToLocalDelta', () => {
  it('is identity at 0° rotation with no flip', () => {
    expect(round(screenToLocalDelta(1, 0, 0, false))).toEqual({ dx: 1, dy: 0 });
  });

  it('0° vertical is identity', () => {
    expect(round(screenToLocalDelta(0, 1, 0, false))).toEqual({ dx: 0, dy: 1 });
  });

  it('90° — screen right maps to frame up', () => {
    expect(round(screenToLocalDelta(1, 0, 90, false))).toEqual({ dx: 0, dy: -1 });
  });

  it('90° — screen down maps to frame right', () => {
    expect(round(screenToLocalDelta(0, 1, 90, false))).toEqual({ dx: 1, dy: 0 });
  });

  it('180° — screen right maps to frame left', () => {
    expect(round(screenToLocalDelta(1, 0, 180, false))).toEqual({ dx: -1, dy: 0 });
  });

  it('180° — screen down maps to frame up', () => {
    expect(round(screenToLocalDelta(0, 1, 180, false))).toEqual({ dx: 0, dy: -1 });
  });

  it('270° — screen right maps to frame down', () => {
    expect(round(screenToLocalDelta(1, 0, 270, false))).toEqual({ dx: 0, dy: 1 });
  });

  it('270° — screen down maps to frame left', () => {
    expect(round(screenToLocalDelta(0, 1, 270, false))).toEqual({ dx: -1, dy: 0 });
  });

  it('flip mirrors the x axis', () => {
    expect(round(screenToLocalDelta(1, 0, 0, true))).toEqual({ dx: -1, dy: 0 });
  });

  it('−90° (rotate-left) behaves like 270°', () => {
    expect(round(screenToLocalDelta(1, 0, -90, false))).toEqual({ dx: 0, dy: 1 });
  });
});
