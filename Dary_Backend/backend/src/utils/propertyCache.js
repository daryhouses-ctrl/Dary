
import { deleteMemoryCacheByPrefix } from "./memoryCache.js";

const PROPERTY_CACHE_PREFIX = "properties:public:";

export function clearPropertyCache() {
  deleteMemoryCacheByPrefix(PROPERTY_CACHE_PREFIX);
  deleteMemoryCacheByPrefix("dashboard:properties");
  deleteMemoryCacheByPrefix("dashboard:analytics");
  deleteMemoryCacheByPrefix("dashboard:owner:");
  deleteMemoryCacheByPrefix("properties:my:");
  deleteMemoryCacheByPrefix("properties:id:");
}

