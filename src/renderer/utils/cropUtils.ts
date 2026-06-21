export function screenToLocalDelta(
  dx: number,
  dy: number,
  rotationDeg: number,
  flipped: boolean,
): { dx: number; dy: number } {
  const θ = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(θ);
  const sin = Math.sin(θ);
  const ldx = dx * cos + dy * sin;
  const ldy = -dx * sin + dy * cos;
  return { dx: flipped ? -ldx : ldx, dy: ldy };
}
