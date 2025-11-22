export function damp(current: number, target: number, lambda: number, dt: number) {
  // Exponential damping
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
