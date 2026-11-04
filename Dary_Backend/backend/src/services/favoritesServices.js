import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCacheByPrefix,
} from "../utils/memoryCache.js";

const inFlightFavorites = new Map();

function clearUserFavoritesCache(userId) {
  if (userId) {
    deleteMemoryCacheByPrefix(`favorites:${userId}`);
  }
}

export async function addFavoriteService(userId, propertyId) {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      status: true,
      isAvailable: true,
    },
  });

  if (!property) {
    throw new AppError("Property not found", 404);
  }

  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  if (existingFavorite) {
    throw new AppError("Property is already in your favorites", 409);
  }

  const favorite = await prisma.favorite.create({
    data: {
      userId,
      propertyId,
    },
    include: {
      property: {
        include: {
          images: {
            orderBy: {
              order: "asc",
            },
          },
        },
      },
    },
  });

  if (favorite.property?.images) {
    favorite.property.images = favorite.property.images.slice(0, 1);
  }

  clearUserFavoritesCache(userId);

  return favorite;
}

export async function getMyFavoritesService(userId) {
  const cacheKey = `favorites:${userId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  if (inFlightFavorites.has(cacheKey)) {
    return inFlightFavorites.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const favorites = await prisma.favorite.findMany({
        where: {
          userId,
          property: {
            deletedAt: null,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          property: {
            include: {
              images: {
                orderBy: {
                  order: "asc",
                },
              },
              owner: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      for (const fav of favorites) {
        if (fav.property?.images) {
          fav.property.images = fav.property.images.slice(0, 1);
        }
      }

      setMemoryCache(cacheKey, favorites, 60);
      return favorites;
    } finally {
      inFlightFavorites.delete(cacheKey);
    }
  })();

  inFlightFavorites.set(cacheKey, promise);
  return promise;
}

export async function removeFavoriteService(userId, propertyId) {
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  if (!favorite) {
    throw new AppError("Property is not in your favorites", 404);
  }

  await prisma.favorite.delete({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  clearUserFavoritesCache(userId);

  return {
    propertyId,
    message: "Property removed from favorites successfully",
  };
}
