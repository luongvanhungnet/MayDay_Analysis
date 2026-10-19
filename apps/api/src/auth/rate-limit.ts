export class RateLimitWindow {
  private readonly buckets = new Map<string, { count: number; expires: number }>();
  constructor(private readonly maximum: number, private readonly duration: number) {}
  allow(key: string, now = Date.now()): boolean {
    if (this.buckets.size > 10000) for (const [id, entry] of this.buckets) if (entry.expires <= now) this.buckets.delete(id);
    const current = this.buckets.get(key);
    if (!current || current.expires <= now) { this.buckets.set(key, { count: 1, expires: now + this.duration }); return true; }
    current.count++;
    return current.count <= this.maximum;
  }
}
