'use client';

interface CacheEntry<T> {
  data: T;
  updatedAt: number;
}

interface StoreShape {
  ownerId: string | null;
  entries: Map<string, CacheEntry<unknown>>;
}

function getStore(): StoreShape | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const win = window as unknown as { __smnQueryCache?: StoreShape };
  if (!win.__smnQueryCache) {
    win.__smnQueryCache = {
      ownerId: null,
      entries: new Map(),
    };
  }
  return win.__smnQueryCache;
}

/**
 * Scope cache entries strictly to the active authenticated account ID.
 * Changing accounts or signing out wipes all cached data immediately.
 */
export function setActiveCacheOwner(accountId: string | null): void {
  const store = getStore();
  if (!store) return;
  if (accountId === null) {
    store.ownerId = null;
    store.entries.clear();
    return;
  }
  if (store.ownerId && store.ownerId !== accountId) {
    store.entries.clear();
  }
  store.ownerId = accountId;
}

export function getCachedQuery<T>(key: string, maxAgeMs = 120_000): T | null {
  const store = getStore();
  if (!store) return null;
  const hit = store.entries.get(key);
  if (!hit) return null;
  if (maxAgeMs > 0 && Date.now() - hit.updatedAt > maxAgeMs) {
    return null;
  }
  return hit.data as T;
}

export function setCachedQuery<T>(key: string, data: T): void {
  const store = getStore();
  if (!store) return;
  store.entries.set(key, { data, updatedAt: Date.now() });
}

export function invalidateQueryKey(keyOrPrefix: string): void {
  const store = getStore();
  if (!store) return;
  for (const existingKey of Array.from(store.entries.keys())) {
    if (existingKey === keyOrPrefix || existingKey.startsWith(keyOrPrefix)) {
      store.entries.delete(existingKey);
    }
  }
}

export function clearAllQueryCache(): void {
  const store = getStore();
  if (!store) return;
  store.ownerId = null;
  store.entries.clear();
}
