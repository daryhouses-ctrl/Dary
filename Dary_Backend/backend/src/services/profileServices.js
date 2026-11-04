import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  cloudinaryUploadImage,
  cloudinaryRemove,
} from "../core/cloudinary/Cloudinary.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCacheByPrefix,
} from "../utils/memoryCache.js";

const VALID_GENDERS = ["MALE", "FEMALE"];
const inFlightProfile = new Map();

export function clearUserProfileCache(userId) {
  if (userId) {
    deleteMemoryCacheByPrefix(`profile:me:${userId}`);
  }
}

// my profile
export async function getMyProfileService(userId, t) {
  const cacheKey = `profile:me:${userId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  if (inFlightProfile.has(cacheKey)) {
    return inFlightProfile.get(cacheKey);
  }

  const promise = (async () => {
    try {
      let profile = await prisma.profile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              whatsappPhone: true,
              avatar: true,
              status: true,
              isVerified: true,
              userRoles: {
                include: {
                  role: true,
                },
              },
            },
          },
        },
      });

      if (!profile) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            whatsappPhone: true,
            avatar: true,
            status: true,
            isVerified: true,
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        });

        if (!user) {
          throw new AppError(t("profile.notFound"), 404);
        }
        try {
          profile = await prisma.profile.create({
            data: { userId },
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  phone: true,
                  whatsappPhone: true,
                  avatar: true,
                  status: true,
                  isVerified: true,
                  userRoles: {
                    include: {
                      role: true,
                    },
                  },
                },
              },
            },
          });
        } catch {
          profile = {
            id: null,
            userId,
            user,
          };
        }
      }

      const userRoles = profile.user?.userRoles || [];
      const roles = userRoles
        .map((ur) => ur.role?.name || ur.name)
        .filter(Boolean);
      const primaryRole = roles[0] || "tenant";

      const result = {
        ...profile,
        roles,
        role: primaryRole,
        user: {
          ...profile.user,
          roles,
          role: primaryRole,
        },
      };

      setMemoryCache(cacheKey, result, 60);
      return result;
    } finally {
      inFlightProfile.delete(cacheKey);
    }
  })();

  inFlightProfile.set(cacheKey, promise);
  return promise;
}

// Create or Update  profile
export async function upsertProfileService(userId, data, t) {
  const {
    gender,
    birthDate,
    nationality,
    university,
    faculty,
    country,
    city,
    address,
    latitude,
    longitude,
    bio,
  } = data;

  if (gender && !VALID_GENDERS.includes(gender)) {
    throw new AppError(t("profile.invalidGender"), 400);
  }

  if (
    (latitude != null && longitude == null) ||
    (longitude != null && latitude == null)
  ) {
    throw new AppError(t("profile.locationBothRequired"), 400);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  const parsedLat =
    latitude !== undefined && latitude !== null && latitude !== ""
      ? Number(latitude)
      : undefined;
  const parsedLng =
    longitude !== undefined && longitude !== null && longitude !== ""
      ? Number(longitude)
      : undefined;

  const payload = {
    gender,
    birthDate: birthDate ? new Date(birthDate) : undefined,
    nationality,
    university,
    faculty,
    country,
    city,
    address,
    latitude: parsedLat,
    longitude: parsedLng,
    bio,
  };

  Object.keys(payload).forEach(
    (key) => payload[key] === undefined && delete payload[key],
  );

  const profile = await prisma.profile.upsert({
    where: { userId },
    update: payload,
    create: {
      userId,
      ...payload,
    },
  });

  clearUserProfileCache(userId);

  return profile;
}

// Update Avatar
export async function updateAvatarService(userId, file, t) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  if (!file) {
    throw new AppError(t("profile.avatarRequired"), 400);
  }

  if (user.avatarPublicId) {
    await cloudinaryRemove(user.avatarPublicId);
  }

  const uploaded = await cloudinaryUploadImage(file.buffer);

  const updatedUser = await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      avatar: uploaded.secure_url,
      avatarPublicId: uploaded.public_id,
    },
    select: {
      avatar: true,
      avatarPublicId: true,
    },
  });

  clearUserProfileCache(userId);

  return updatedUser;
}

// Delete Avatar
export async function deleteAvatarService(userId, t) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new AppError(t("common.userNotFound"), 404);
  }

  if (!user.avatarPublicId) {
    throw new AppError(t("profile.avatarNotFound"), 404);
  }

  await cloudinaryRemove(user.avatarPublicId);

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      avatar: null,
      avatarPublicId: null,
    },
  });

  clearUserProfileCache(userId);

  return {
    message: t("profile.avatarDeleted"),
  };
}

// Get public profile (data i let to appear in website)
export async function getPublicProfileService(userId, t) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: {
      university: true,
      faculty: true,
      city: true,
      bio: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          avatar: true,
        },
      },
    },
  });

  if (!profile) {
    throw new AppError(t("profile.notFound"), 404);
  }

  return profile;
}
