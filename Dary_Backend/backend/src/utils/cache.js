import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCache,
  deleteMemoryCacheByPrefix,
  deleteMemoryCacheByPattern,
} from "./memoryCache.js";

const inFlight = new Map();

export async function getCache(key) {
  return getMemoryCache(key);
}

export async function setCache(key, data, ttl = 60) {
  setMemoryCache(key, data, ttl);
}

export async function deleteCache(key) {
  deleteMemoryCache(key);
}

export async function deleteCacheByPattern(pattern) {
  deleteMemoryCacheByPattern(pattern);
}

export function generateCacheKey(prefix, query) {
  if (!query || typeof query !== "object") return prefix;
  const sortedQuery = Object.keys(query)
    .filter(
      (k) => query[k] !== undefined && query[k] !== null && query[k] !== "",
    )
    .sort()
    .reduce((result, key) => {
      result[key] = query[key];
      return result;
    }, {});

  return `${prefix}:${JSON.stringify(sortedQuery)}`;
}

export async function getOrSetCache(key, ttl, fetcher) {
  const cachedData = getMemoryCache(key);

  if (cachedData !== null) {
    return cachedData;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const promise = (async () => {
    try {
      const data = await fetcher();
      if (data !== undefined && data !== null) {
        setMemoryCache(key, data, ttl);
      }
      return data;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

export default {
  get: getCache,
  set: setCache,
  del: deleteCache,
};
