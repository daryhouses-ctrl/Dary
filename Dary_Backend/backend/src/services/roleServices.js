import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import { getUserRoleNames } from "../utils/rbac.js";

export async function createRoleService({ name, description }, t) {
  const normalizedName = name.trim().toLowerCase();

  const existing = await prisma.role.findUnique({
    where: {
      name: normalizedName,
    },
  });

  if (existing) {
    throw new AppError(t("role.alreadyExists"), 409);
  }

  const role = await prisma.role.create({
    data: {
      name: normalizedName,
      description: description?.trim() || null,
    },
  });

  return role;
}

export async function findAllRolesService(t) {
  return prisma.role.findMany({
    include: { rolePermissions: { include: { permission: true } } },
  });
}

export async function assignRoleService({ userId, roleName }, t) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) throw new AppError(t("common.userNotFound"), 404);

  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new AppError(t("role.notFound"), 404);

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId } });
    await tx.userRole.create({ data: { userId, roleId: role.id } });
  });

  // لو owner اعمله محفظه والحته دي هتتربط قدام مع wallet
  if (roleName === "owner") {
    const hasWallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!hasWallet) {
      await prisma.wallet.create({ data: { userId, balance: 0 } });
    }
  }
  return { message: t("role.assignSuccess", { role: roleName }) };
}

export async function removeRoleService({ userId, roleName }, t) {
  const role = await prisma.role.findUnique({ where: { name: roleName } });
  if (!role) throw new AppError(t("role.notFound"), 404);

  await prisma.userRole.deleteMany({ where: { userId, roleId: role.id } });
  return { message: t("role.removeSuccess", { role: roleName }) };
}

export async function getUserRolesService(userId, t) {
  return getUserRoleNames(userId);
}
