// A minimal in-memory Cache API (jsdom has none). Keys are URLs; stores clones like the real one.
export class FakeCache {
  entries = new Map<string, Response>();
  async match(req: RequestInfo | URL) {
    const r = this.entries.get(keyOf(req));
    return r ? r.clone() : undefined;
  }
  async put(req: RequestInfo | URL, res: Response) {
    this.entries.set(keyOf(req), res.clone());
  }
  async delete(req: RequestInfo | URL) {
    return this.entries.delete(keyOf(req));
  }
}

const keyOf = (req: RequestInfo | URL) => (typeof req === 'string' ? req : req instanceof URL ? req.href : req.url);

export class FakeCacheStorage {
  stores = new Map<string, FakeCache>();
  async open(name: string) {
    if (!this.stores.has(name)) this.stores.set(name, new FakeCache());
    return this.stores.get(name)! as unknown as Cache;
  }
  async keys() {
    return [...this.stores.keys()];
  }
  async delete(name: string) {
    return this.stores.delete(name);
  }
  async has(name: string) {
    return this.stores.has(name);
  }
  async match(req: RequestInfo | URL) {
    for (const c of this.stores.values()) {
      const hit = await c.match(req);
      if (hit) return hit;
    }
    return undefined;
  }
}

export const asCacheStorage = (f: FakeCacheStorage) => f as unknown as CacheStorage;
