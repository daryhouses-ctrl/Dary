import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";

export async function findAllPermissionsService(t) {
  return prisma.permission.findMany({ orderBy: { name: "asc" } });
}

export async function createPermissionService({ name, description }, t) {
  const existing = await prisma.permission.findUnique({ where: { name } });
  if (existing) {
    throw new AppError(t("permission.alreadyExists"), 409);
  }

  return prisma.permission.create({ data: { name, description } });
}

export async function updatePermissionService(id, data, t) {
  const permission = await prisma.permission.findUnique({ where: { id } });
  if (!permission) throw new AppError(t("permission.notFound"), 404);

  return prisma.permission.update({ where: { id }, data });
}

export async function removePermissionService(id, t) {
  const permission = await prisma.permission.findUnique({ where: { id } });
  if (!permission) throw new AppError(t("permission.notFound"), 404);

  await prisma.permission.delete({ where: { id } });
  return { message: t("permission.deleteSuccess") };
}

export async function assignPermissionsToRoleService(
  { roleId, permissionIds },
  t,
) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new AppError(t("role.notFound"), 404);

  if (!permissionIds?.length) {
    throw new AppError(t("permission.idsRequired"), 400);
  }

  const operations = permissionIds.map((permissionId) =>
    prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    }),
  );

  await prisma.$transaction(operations);
  return { message: t("permission.assignedToRole") };
}

export async function getRolePermissionsService(roleId, t) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw new AppError(t("role.notFound"), 404);

  const rolePermissions = await prisma.rolePermission.findMany({
    where: { roleId },
    include: { permission: true },
  });

  return rolePermissions.map((rp) => rp.permission);
}

export async function removePermissionFromRoleService(roleId, permissionId, t) {
  await prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
  return { message: t("permission.removedFromRole") };
}
