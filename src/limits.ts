/** In-memory limits for a small single-instance deployment. */
export class TrafficGuard {
  private minute = -1;
  private day = -1;
  private daily = 0;
  private clients = new Map<string, number>();
  constructor(private options = { perMinute: 6, perDay: 100 }) {
    if (!Number.isInteger(options.perMinute) || options.perMinute < 1 || !Number.isInteger(options.perDay) || options.perDay < 1) throw new Error("Invalid traffic limits");
  }
  take(client: string, now = Date.now()) {
    const minute = Math.floor(now / 60000), day = Math.floor(now / 86400000);
    if (day !== this.day) { this.day = day; this.daily = 0; }
    if (minute !== this.minute) { this.minute = minute; this.clients.clear(); }
    const count = this.clients.get(client) ?? 0;
    if (this.daily >= this.options.perDay || count >= this.options.perMinute || (!this.clients.has(client) && this.clients.size >= 4096)) return false;
    this.clients.set(client, count + 1); this.daily++;
    return true;
  }
}
