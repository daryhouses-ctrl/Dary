import { prisma } from "../PrismaService.js";

const permissions = [
  // Auth
  {
    name: "auth.register",
    description: "Register a new user",
  },
  {
    name: "auth.login",
    description: "Login user",
  },
  {
    name: "auth.logout",
    description: "Logout user",
  },
  {
    name: "auth.refresh_token",
    description: "Refresh access token",
  },
  {
    name: "auth.verify_otp",
    description: "Verify OTP",
  },
  {
    name: "auth.resend_otp",
    description: "Resend OTP",
  },
  {
    name: "auth.forget_password",
    description: "Request password reset",
  },
  {
    name: "auth.reset_password",
    description: "Reset password",
  },
  {
    name: "auth.google_login",
    description: "Login with Google",
  },

  // User

  {
    name: "user.read",
    description: "View users",
  },
  {
    name: "user.deactivate",
    description: "Deactivate user account",
  },
  {
    name: "user.reactivate",
    description: "Reactivate user account",
  },
  {
    name: "user.delete",
    description: "Delete user account",
  },

  // Profile

  {
    name: "profile.read",
    description: "View own profile",
  },
  {
    name: "profile.update",
    description: "Update own profile",
  },
  {
    name: "profile.avatar.update",
    description: "Update profile avatar",
  },
  {
    name: "profile.avatar.delete",
    description: "Delete profile avatar",
  },
  {
    name: "profile.public.read",
    description: "View public profile",
  },

  // Property

  {
    name: "property.create",
    description: "Create property",
  },
  {
    name: "property.read",
    description: "View properties",
  },
  {
    name: "property.read_own",
    description: "View own properties",
  },
  {
    name: "property.update",
    description: "Update property",
  },
  {
    name: "property.delete",
    description: "Delete property",
  },
  {
    name: "property.availability.toggle",
    description: "Toggle property availability",
  },
  {
    name: "property.pending.read",
    description: "View pending properties",
  },
  {
    name: "property.review",
    description: "Review property",
  },
  {
    name: "property.suspend",
    description: "Suspend property",
  },

  // Property Rooms

  {
    name: "property.room.create",
    description: "Create property room",
  },
  {
    name: "property.room.update",
    description: "Update property room",
  },
  {
    name: "property.room.delete",
    description: "Delete property room",
  },
  {
    name: "property.room.photo.update",
    description: "Update room photo",
  },

  // Property Images

  {
    name: "property.image.upload",
    description: "Upload property images",
  },
  {
    name: "property.image.read",
    description: "View property images",
  },
  {
    name: "property.image.delete",
    description: "Delete property image",
  },
  {
    name: "property.image.primary",
    description: "Set primary property image",
  },
  {
    name: "property.image.reorder",
    description: "Reorder property images",
  },

  // Booking

  {
    name: "booking.create",
    description: "Create booking",
  },
  {
    name: "booking.read",
    description: "View bookings",
  },
  {
    name: "booking.read_own",
    description: "View own bookings",
  },
  {
    name: "booking.read_property",
    description: "View bookings for owned property",
  },
  {
    name: "booking.cancel",
    description: "Cancel booking",
  },
  {
    name: "booking.assign_admin",
    description: "Assign admin to booking",
  },
  {
    name: "booking.status.update",
    description: "Update booking status",
  },

  {
    name: "dashboard.bookings.revenue.read",
    description: "View total bookings revenue",
  },

  // Contract

  {
    name: "contract.create",
    description: "Create contract",
  },
  {
    name: "contract.read",
    description: "View contracts",
  },
  {
    name: "contract.read_by_booking",
    description: "View contract by booking",
  },
  {
    name: "contract.send_to_tenant",
    description: "Send contract to tenant",
  },
  {
    name: "contract.forward_to_owner",
    description: "Forward contract to owner",
  },
  {
    name: "contract.tenant_sign",
    description: "Tenant signs contract",
  },
  {
    name: "contract.owner_sign",
    description: "Owner signs contract",
  },
  {
    name: "contract.activate",
    description: "Activate contract",
  },
  {
    name: "contract.cancel",
    description: "Cancel contract",
  },

  // Review

  {
    name: "review.create",
    description: "Create review",
  },
  {
    name: "review.read",
    description: "View reviews",
  },
  {
    name: "review.read_own",
    description: "View own reviews",
  },
  {
    name: "review.read_pending",
    description: "View pending reviews",
  },
  {
    name: "review.moderate",
    description: "Moderate reviews",
  },

  // Report
  {
    name: "report.create",
    description: "Create report",
  },
  {
    name: "report.read",
    description: "View reports",
  },
  {
    name: "report.read_own",
    description: "View own reports",
  },
  {
    name: "report.priority.update",
    description: "Update report priority",
  },
  {
    name: "report.resolve",
    description: "Resolve report",
  },

  // Notification
  {
    name: "notification.create",
    description: "Create notification",
  },
  {
    name: "notification.read",
    description: "View notifications",
  },
  {
    name: "notification.send",
    description: "Send notification",
  },
  {
    name: "notification.delete",
    description: "Delete notification",
  },

  // Support Ticket
  {
    name: "support_ticket.create",
    description: "Create support ticket",
  },
  {
    name: "support_ticket.read",
    description: "View support tickets",
  },
  {
    name: "support_ticket.read_own",
    description: "View own support tickets",
  },
  {
    name: "support_ticket.message.create",
    description: "Send support ticket message",
  },
  {
    name: "support_ticket.assign_admin",
    description: "Assign admin to support ticket",
  },
  {
    name: "support_ticket.status.update",
    description: "Update support ticket status",
  },

  // Role

  {
    name: "role.create",
    description: "Create a new role",
  },
  {
    name: "role.read",
    description: "View roles",
  },
  {
    name: "role.assign",
    description: "Assign role to user",
  },
  {
    name: "role.remove",
    description: "Remove role from user",
  },

  // Permission
  {
    name: "permission.create",
    description: "Create permission",
  },
  {
    name: "permission.read",
    description: "View permissions",
  },
  {
    name: "permission.update",
    description: "Update permission",
  },
  {
    name: "permission.delete",
    description: "Delete permission",
  },
  {
    name: "permission.assign",
    description: "Assign permission to role",
  },
  {
    name: "permission.remove",
    description: "Remove permission from role",
  },

  // Contract

  {
    name: "contract.create",
    description: "Create contract",
  },
  {
    name: "contract.read",
    description: "View contract",
  },
  {
    name: "contract.read_all",
    description: "View all contracts",
  },
  {
    name: "contract.read_by_booking",
    description: "View contract by booking",
  },
  {
    name: "contract.send_to_tenant",
    description: "Send contract to tenant",
  },
  {
    name: "contract.forward_to_owner",
    description: "Forward contract to owner",
  },
  {
    name: "contract.tenant_sign",
    description: "Tenant signs contract",
  },
  {
    name: "contract.owner_sign",
    description: "Owner signs contract",
  },
  {
    name: "contract.activate",
    description: "Activate contract",
  },
  {
    name: "contract.cancel",
    description: "Cancel contract",
  },
  {
    name: "contract.read_all",
    description: "View all contracts",
  },

  {
    name: "dashboard.properties.read",
    description: "View property dashboard",
  },
  {
    name: "dashboard.users.read",
    description: "View user dashboard",
  },
  {
    name: "dashboard.bookings.read",
    description: "View booking dashboard",
  },
  {
    name: "dashboard.reports.read",
    description: "View report dashboard",
  },
  {
    name: "dashboard.analytics.read",
    description: "View dashboard analytics",
  },
  {
    name: "recently_viewed.read",
    description: "View recently viewed properties",
  },
  {
    name: "recently_viewed.create",
    description: "Add property to recently viewed",
  },
  {
    name: "recently_viewed.delete",
    description: "Remove property from recently viewed",
  },
  {
    name: "recently_viewed.clear",
    description: "Clear recently viewed properties",
  },
  {
    name: "rental.read_own",
    description: "View own rentals",
  },

  {
    name: "favorite.create",
    description: "Add property to favorites",
  },
  {
    name: "favorite.read_own",
    description: "View own favorite properties",
  },
  {
    name: "favorite.delete",
    description: "Remove property from favorites",
  },

  {
    name: "saved_search.create",
    description: "Create saved search",
  },
  {
    name: "saved_search.read_own",
    description: "View own saved searches",
  },
  {
    name: "saved_search.update",
    description: "Update saved search",
  },
  {
    name: "saved_search.delete",
    description: "Delete saved search",
  },
];

export async function seedPermissions() {
  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: {
        name: permission.name,
      },
      update: {
        description: permission.description,
      },
      create: permission,
    });
  }

  console.log(` ${permissions.length} permissions seeded successfully.`);
}
