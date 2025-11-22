export class Clock {
  private last = Date.now();
  tick(): number {
    const now = Date.now();
    const dt = (now - this.last) / 1000; // seconds
    this.last = now;
    return dt;
  }
}
