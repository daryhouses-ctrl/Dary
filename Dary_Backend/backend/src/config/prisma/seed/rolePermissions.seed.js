import { prisma } from "../PrismaService.js";

const rolePermissions = {
  super_admin: ["*"],

  admin: [
    "user.read",
    "user.delete",
    "user.deactivate",
    "user.reactivate",

    "property.read",
    "property.pending.read",
    "property.review",
    "property.suspend",

    "booking.read",
    "booking.assign_admin",
    "booking.status.update",

    "contract.create",
    "contract.read",
    "contract.read_all",
    "contract.read_by_booking",
    "contract.send_to_tenant",
    "contract.forward_to_owner",
    "contract.activate",
    "contract.cancel",

    "review.read",
    "review.read_pending",
    "review.moderate",

    "report.read",
    "report.priority.update",
    "report.resolve",

    "support_ticket.read",
    "support_ticket.assign_admin",
    "support_ticket.status.update",

    "notification.create",
    "notification.send",
    "notification.read",
    "notification.delete",

    "profile.read",
    "profile.update",
    "profile.avatar.update",
    "profile.avatar.delete",
    "profile.public.read",

    "review.create",
    "review.read_own",

    "dashboard.properties.read",
    "dashboard.users.read",
    "dashboard.bookings.read",
    "dashboard.reports.read",
    "dashboard.analytics.read",
  ],

  owner: [
    "profile.read",
    "profile.update",
    "profile.avatar.update",
    "profile.avatar.delete",
    "profile.public.read",

    "property.create",
    "property.read",
    "property.read_own",
    "property.update",
    "property.delete",
    "property.availability.toggle",

    "property.room.create",
    "property.room.update",
    "property.room.delete",
    "property.room.photo.update",

    "property.image.upload",
    "property.image.read",
    "property.image.delete",
    "property.image.primary",
    "property.image.reorder",

    "booking.read_property",

    "contract.read",
    "contract.read_by_booking",
    "contract.owner_sign",

    "report.create",
    "report.read",
    "report.read_own",

    "support_ticket.create",
    "support_ticket.read_own",
    "support_ticket.message.create",

    "notification.read",

    "favorite.create",
    "favorite.read_own",
    "favorite.delete",

    "saved_search.create",
    "saved_search.read_own",
    "saved_search.update",
    "saved_search.delete",

    "recently_viewed.read",
    "recently_viewed.create",
    "recently_viewed.delete",
    "recently_viewed.clear",
  ],

  tenant: [
    "profile.read",
    "profile.update",
    "profile.avatar.update",
    "profile.avatar.delete",
    "profile.public.read",

    "property.read",

    "booking.create",
    "booking.read_own",
    "booking.cancel",

    "contract.read",
    "contract.read_by_booking",
    "contract.tenant_sign",

    "review.create",
    "review.read",
    "review.read_own",

    "report.create",
    "report.read_own",

    "support_ticket.create",
    "support_ticket.read_own",
    "support_ticket.message.create",

    "notification.read",

    "favorite.create",
    "favorite.read_own",
    "favorite.delete",

    "saved_search.create",
    "saved_search.read_own",
    "saved_search.update",
    "saved_search.delete",

    "recently_viewed.read",
    "recently_viewed.create",
    "recently_viewed.delete",
    "recently_viewed.clear",

    "rental.read_own",
  ],
};

export async function seedRolePermissions() {
  for (const [roleName, permissions] of Object.entries(rolePermissions)) {
    const role = await prisma.role.findUnique({
      where: {
        name: roleName,
      },
    });

    if (!role) {
      console.log(` Role not found: ${roleName}`);
      continue;
    }

    let permissionRecords;

    if (permissions.includes("*")) {
      permissionRecords = await prisma.permission.findMany();
    } else {
      permissionRecords = await prisma.permission.findMany({
        where: {
          name: {
            in: permissions,
          },
        },
      });
    }

    const permissionIds = permissionRecords.map((permission) => permission.id);

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permissionId: {
          notIn: permissionIds,
        },
      },
    });

    for (const permission of permissionRecords) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }

    console.log(` ${roleName}: ${permissionRecords.length} permissions synced`);
  }

  console.log(" Role permissions synced successfully.");
}
