/**
 * Lightweight in-process TTL cache.
 * Safe only for read-heavy, non-sensitive, per-organization data.
 * Does NOT replace Redis — use for static-ish config: appSettings, branding, plans.
 *
 * TTL: configured per cache instance.
 * Invalidation: manual via invalidate() or invalidateAll().
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class SimpleCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T): void {
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidateAll(): void {
    this.store.clear();
  }

  /** Lazy getter: if key is cached return it, else call loader, cache result, return it. */
  async getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await loader();
    this.set(key, value);
    return value;
  }
}
