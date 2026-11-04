import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCacheByPrefix,
} from "../utils/memoryCache.js";

const inFlightSavedSearches = new Map();

function clearUserSavedSearchesCache(userId) {
  if (userId) {
    deleteMemoryCacheByPrefix(`saved-searches:${userId}`);
  }
}

export async function createSavedSearchService(userId, data) {
  const {
    name,
    governorate,
    city,
    district,
    propertyType,
    propertyClass,
    targetTenantType,
    genderAllowed,
    minPrice,
    maxPrice,
    rooms,
    isFurnished,
    electricityIncluded,
    waterIncluded,
    internetIncluded,
    nearestUniversity,
  } = data;

  if (
    minPrice !== undefined &&
    maxPrice !== undefined &&
    Number(minPrice) > Number(maxPrice)
  ) {
    throw new AppError("minPrice cannot be greater than maxPrice", 400);
  }

  const savedSearch = await prisma.savedSearch.create({
    data: {
      userId,
      name,
      governorate,
      city,
      district,
      propertyType,
      propertyClass,
      targetTenantType,
      genderAllowed,

      minPrice:
        minPrice !== undefined && minPrice !== null ? minPrice : undefined,

      maxPrice:
        maxPrice !== undefined && maxPrice !== null ? maxPrice : undefined,

      rooms,
      isFurnished,
      electricityIncluded,
      waterIncluded,
      internetIncluded,

      nearestUniversity,
    },
  });

  clearUserSavedSearchesCache(userId);

  return savedSearch;
}

export async function getMySavedSearchesService(userId) {
  const cacheKey = `saved-searches:${userId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  if (inFlightSavedSearches.has(cacheKey)) {
    return inFlightSavedSearches.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const savedSearches = await prisma.savedSearch.findMany({
        where: {
          userId,
        },

        orderBy: {
          createdAt: "desc",
        },
      });

      setMemoryCache(cacheKey, savedSearches, 60);
      return savedSearches;
    } finally {
      inFlightSavedSearches.delete(cacheKey);
    }
  })();

  inFlightSavedSearches.set(cacheKey, promise);
  return promise;
}

export async function getSavedSearchByIdService(userId, savedSearchId) {
  const savedSearch = await prisma.savedSearch.findFirst({
    where: {
      id: savedSearchId,
      userId,
    },
  });

  if (!savedSearch) {
    throw new AppError("Saved search not found", 404);
  }

  return savedSearch;
}

export async function updateSavedSearchService(userId, savedSearchId, data) {
  const existingSearch = await prisma.savedSearch.findFirst({
    where: {
      id: savedSearchId,
      userId,
    },
  });

  if (!existingSearch) {
    throw new AppError("Saved search not found", 404);
  }

  const minPrice =
    data.minPrice !== undefined ? data.minPrice : existingSearch.minPrice;

  const maxPrice =
    data.maxPrice !== undefined ? data.maxPrice : existingSearch.maxPrice;

  if (
    minPrice !== null &&
    minPrice !== undefined &&
    maxPrice !== null &&
    maxPrice !== undefined &&
    Number(minPrice) > Number(maxPrice)
  ) {
    throw new AppError("minPrice cannot be greater than maxPrice", 400);
  }

  const updatedSearch = await prisma.savedSearch.update({
    where: {
      id: savedSearchId,
    },

    data: {
      ...(data.name !== undefined && {
        name: data.name,
      }),

      ...(data.governorate !== undefined && {
        governorate: data.governorate,
      }),

      ...(data.city !== undefined && {
        city: data.city,
      }),

      ...(data.district !== undefined && {
        district: data.district,
      }),

      ...(data.propertyType !== undefined && {
        propertyType: data.propertyType,
      }),

      ...(data.propertyClass !== undefined && {
        propertyClass: data.propertyClass,
      }),

      ...(data.targetTenantType !== undefined && {
        targetTenantType: data.targetTenantType,
      }),

      ...(data.genderAllowed !== undefined && {
        genderAllowed: data.genderAllowed,
      }),

      ...(data.minPrice !== undefined && {
        minPrice: data.minPrice,
      }),

      ...(data.maxPrice !== undefined && {
        maxPrice: data.maxPrice,
      }),

      ...(data.rooms !== undefined && {
        rooms: data.rooms,
      }),

      ...(data.isFurnished !== undefined && {
        isFurnished: data.isFurnished,
      }),

      ...(data.electricityIncluded !== undefined && {
        electricityIncluded: data.electricityIncluded,
      }),

      ...(data.waterIncluded !== undefined && {
        waterIncluded: data.waterIncluded,
      }),

      ...(data.internetIncluded !== undefined && {
        internetIncluded: data.internetIncluded,
      }),

      ...(data.nearestUniversity !== undefined && {
        nearestUniversity: data.nearestUniversity,
      }),
    },
  });

  clearUserSavedSearchesCache(userId);

  return updatedSearch;
}

export async function deleteSavedSearchService(userId, savedSearchId) {
  const existingSearch = await prisma.savedSearch.findFirst({
    where: {
      id: savedSearchId,
      userId,
    },
  });

  if (!existingSearch) {
    throw new AppError("Saved search not found", 404);
  }

  await prisma.savedSearch.delete({
    where: {
      id: savedSearchId,
    },
  });

  clearUserSavedSearchesCache(userId);

  return {
    id: savedSearchId,
    message: "Saved search deleted successfully",
  };
}
