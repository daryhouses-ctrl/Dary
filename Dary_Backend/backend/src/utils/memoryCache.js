import NodeCache from "node-cache";

const cache = new NodeCache({
  stdTTL: 60,
  checkperiod: 120,
  useClones: false,
});

export function getMemoryCache(key) {
  return cache.get(key) ?? null;
}

export function setMemoryCache(key, data, ttl = 60) {
  cache.set(key, data, ttl);
}

export function deleteMemoryCache(key) {
  cache.del(key);
}

export function deleteMemoryCacheByPrefix(prefix) {
  if (!prefix) return;
  const keys = cache.keys();

  for (const key of keys) {
    if (key.startsWith(prefix)) {
      cache.del(key);
    }
  }
}

export function deleteMemoryCacheByPattern(pattern) {
  if (!pattern) return;
  const keys = cache.keys();

  if (pattern.includes("*")) {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const regex = new RegExp(`^${escaped}$`);
    for (const key of keys) {
      if (regex.test(key)) {
        cache.del(key);
      }
    }
  } else {
    for (const key of keys) {
      if (key.startsWith(pattern)) {
        cache.del(key);
      }
    }
  }
}

export function clearMemoryCache() {
  cache.flushAll();
}

export default cache;
