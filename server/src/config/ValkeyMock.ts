/**
 * In-memory Valkey mock — iovalkey-compatible interface.
 * Used when Valkey/Redis is not available via Docker or WSL.
 */
export class ValkeyMock {
  private store = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private sortedSets = new Map<string, Map<string, number>>();
  private ttlMap = new Map<string, number>();
  private counters = new Map<string, number>();

  on(_event: string, _cb: Function): void {}

  async connect(): Promise<void> {
    console.log('🔵 Using in-memory Valkey mock');
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    this.hashes.clear();
    this.sortedSets.clear();
    this.ttlMap.clear();
    this.counters.clear();
  }

  async quit(): Promise<void> {
    await this.disconnect();
  }

  // ─── String Operations ─────────────────────────────
  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value);
    return 'OK';
  }

  async setEx(key: string, seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, value);
    this.ttlMap.set(key, Date.now() + seconds * 1000);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    if (this.isExpired(key)) return null;
    return this.store.get(key) || null;
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      const deleted = this.store.delete(key) || this.hashes.delete(key) || this.sortedSets.delete(key);
      this.ttlMap.delete(key);
      if (deleted) count++;
    }
    return count;
  }

  async exists(key: string): Promise<number> {
    if (this.isExpired(key)) return 0;
    return this.store.has(key) || this.hashes.has(key) || this.sortedSets.has(key) ? 1 : 0;
  }

  async expire(key: string, _seconds: number): Promise<number> {
    return 1;
  }

  async incr(key: string): Promise<number> {
    const val = (this.counters.get(key) || 0) + 1;
    this.counters.set(key, val);
    return val;
  }

  async keys(pattern: string): Promise<string[]> {
    const all = new Set([
      ...this.store.keys(),
      ...this.hashes.keys(),
      ...this.sortedSets.keys(),
    ]);
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return [...all].filter(k => regex.test(k));
  }

  // ─── Hash Operations ───────────────────────────────
  async hSet(key: string, fieldOrObj: string | Record<string, string>, value?: string): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const map = this.hashes.get(key)!;

    if (typeof fieldOrObj === 'string' && value !== undefined) {
      map.set(fieldOrObj, value);
      return 1;
    } else if (typeof fieldOrObj === 'object') {
      for (const [k, v] of Object.entries(fieldOrObj)) {
        map.set(k, v);
      }
      return Object.keys(fieldOrObj).length;
    }
    return 0;
  }

  async hGet(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) || null;
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    const map = this.hashes.get(key);
    if (!map) return {};
    const result: Record<string, string> = {};
    for (const [k, v] of map) result[k] = v;
    return result;
  }

  async hDel(key: string, ...fields: string[]): Promise<number> {
    const map = this.hashes.get(key);
    if (!map) return 0;
    let count = 0;
    for (const f of fields) {
      if (map.delete(f)) count++;
    }
    return count;
  }

  async hExists(key: string, field: string): Promise<number> {
    return this.hashes.get(key)?.has(field) ? 1 : 0;
  }

  async hLen(key: string): Promise<number> {
    return this.hashes.get(key)?.size || 0;
  }

  async hIncrBy(key: string, field: string, increment: number): Promise<number> {
    if (!this.hashes.has(key)) this.hashes.set(key, new Map());
    const map = this.hashes.get(key)!;
    const current = parseInt(map.get(field) || '0', 10);
    const newVal = current + increment;
    map.set(field, newVal.toString());
    return newVal;
  }

  // ─── Sorted Set Operations ─────────────────────────
  async zAdd(key: string, ...items: Array<{ score: number; value: string }>): Promise<number> {
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
    const map = this.sortedSets.get(key)!;
    for (const item of items) {
      map.set(item.value, item.score);
    }
    return items.length;
  }

  async zRem(key: string, ...members: string[]): Promise<number> {
    const map = this.sortedSets.get(key);
    if (!map) return 0;
    let count = 0;
    for (const m of members) {
      if (map.delete(m)) count++;
    }
    return count;
  }

  async zIncrBy(key: string, increment: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) this.sortedSets.set(key, new Map());
    const map = this.sortedSets.get(key)!;
    const current = map.get(member) || 0;
    const newVal = current + increment;
    map.set(member, newVal);
    return newVal;
  }

  async zRangeWithScores(key: string, min: number, max: number, options?: { rev?: boolean }): Promise<Array<{ value: string; score: number }>> {
    const map = this.sortedSets.get(key);
    if (!map) return [];

    let entries = [...map.entries()].map(([value, score]) => ({ value, score }));

    if (options?.rev) {
      entries.sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
    } else {
      entries.sort((a, b) => a.score - b.score || a.value.localeCompare(b.value));
    }

    const start = min < 0 ? Math.max(0, entries.length + min) : min;
    const end = max < 0 ? entries.length + max : max + 1;

    return entries.slice(start, end);
  }

  // ─── Set Operations ────────────────────────────────
  async sAdd(key: string, ...members: string[]): Promise<number> {
    const existing = this.store.get(key);
    const set = existing ? new Set(JSON.parse(existing)) : new Set<string>();
    let added = 0;
    for (const m of members) {
      if (!set.has(m)) {
        set.add(m);
        added++;
      }
    }
    this.store.set(key, JSON.stringify([...set]));
    return added;
  }

  // ─── Pub/Sub (stub) ─────────────────────────────────
  async publish(_channel: string, _message: string): Promise<number> {
    return 0;
  }

  // ─── Private ────────────────────────────────────────
  private isExpired(key: string): boolean {
    const expiry = this.ttlMap.get(key);
    if (expiry && Date.now() > expiry) {
      this.store.delete(key);
      this.hashes.delete(key);
      this.sortedSets.delete(key);
      this.ttlMap.delete(key);
      return true;
    }
    return false;
  }
}
