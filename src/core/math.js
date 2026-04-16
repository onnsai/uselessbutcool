export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const distance2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const lerpPoint = (current, target, t) => ({
  x: lerp(current.x, target.x, t),
  y: lerp(current.y, target.y, t),
  z: lerp(current.z ?? 0, target.z ?? 0, t),
});

export function mirroredPoint(point) {
  return { x: 1 - point.x, y: point.y, z: point.z ?? 0 };
}

