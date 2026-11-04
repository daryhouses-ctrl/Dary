import crypto from "crypto";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma/PrismaService.js";
import { getMemoryCache, setMemoryCache } from "./memoryCache.js";

export const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_ACCESS_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be defined in the environment.",
  );
}

export const ACCESS_TOKEN_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
export const REFRESH_TOKEN_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";

const getUserRoles = async (userId) => {
  const cacheKey = `user:roles:${userId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached) return cached;

  const userRoles = await prisma.userRole.findMany({
    where: {
      userId,
    },
    select: {
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  const roles = userRoles.map((item) => item.role.name);
  setMemoryCache(cacheKey, roles, 60);
  return roles;
};

export const generateTokens = async (user, preloadedRoles = null) => {
  const roles = Array.isArray(preloadedRoles)
    ? preloadedRoles
    : await getUserRoles(user.id);

  const accessPayload = {
    sub: user.id,
    email: user.email,
    roles,
  };

  const refreshPayload = {
    sub: user.id,
    jti: crypto.randomUUID(),
  };

  const accessToken = jwt.sign(accessPayload, JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRES,
  });

  const refreshToken = jwt.sign(refreshPayload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES,
  });

  return {
    accessToken,
    refreshToken,
    roles,
  };
};
