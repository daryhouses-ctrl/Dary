import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCache,
  deleteMemoryCacheByPrefix,
} from "./memoryCache.js";

export const DASHBOARD_CACHE_PREFIX = "dashboard:";

export const DASHBOARD_TTL = {
  STATS: 180,
  ANALYTICS: 300,
  CALENDAR: 120,
  LIST: 60,
};

export function generateDashboardKey(prefix, query = {}) {
  const sortedParams = Object.keys(query)
    .sort()
    .map((k) => `${k}=${query[k]}`)
    .join("&");
  return sortedParams ? `${prefix}:${sortedParams}` : prefix;
}

const inFlight = new Map();

export async function getOrSetDashboardCache(key, ttl, fetcher) {
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

export function clearDashboardCache(section) {
  if (!section || section === "all") {
    deleteMemoryCacheByPrefix(DASHBOARD_CACHE_PREFIX);
    return;
  }
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}${section}`);
}

export function clearDashboardReportsCache() {
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}reports`);
}

export function clearDashboardBookingsCache(ownerId) {
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}bookings`);
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}calendar`);
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}analytics`);
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}rentals`);
  deleteMemoryCacheByPrefix("booking:property:");
  if (ownerId) {
    deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}owner:${ownerId}`);
  } else {
    deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}owner:`);
  }
}

export function clearDashboardPropertiesCache(ownerId) {
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}properties`);
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}analytics`);
  if (ownerId) {
    deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}owner:${ownerId}`);
  } else {
    deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}owner:`);
  }
}

export function clearDashboardUsersCache() {
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}users`);
  deleteMemoryCacheByPrefix(`${DASHBOARD_CACHE_PREFIX}analytics`);
}
