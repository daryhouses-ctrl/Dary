import { prisma } from "../config/prisma/PrismaService.js";
import { getMemoryCache, setMemoryCache } from "./memoryCache.js";

export async function getUserRoleNames(userId) {
  const cacheKey = `user:roles:${userId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached) return cached;

  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: true },
  });
  const roles = userRoles.map((ur) => ur.role.name);
  setMemoryCache(cacheKey, roles, 60);
  return roles;
}

export async function userHasPermission(userId, permissionName) {
  const cacheKey = `user:perm:${userId}:${permissionName}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  const count = await prisma.rolePermission.count({
    where: {
      permission: { name: permissionName },
      role: { userRoles: { some: { userId } } },
    },
  });
  const allowed = count > 0;
  setMemoryCache(cacheKey, allowed, 60);
  return allowed;
}
