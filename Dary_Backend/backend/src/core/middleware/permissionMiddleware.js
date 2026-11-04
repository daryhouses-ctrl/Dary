import { AppError } from "./error/AppError.js";
import { getUserRoleNames, userHasPermission } from "../../utils/rbac.js";

export function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      const roles =
        req.user?.roles && Array.isArray(req.user.roles) && req.user.roles.length > 0
          ? req.user.roles
          : await getUserRoleNames(req.user.id);
      if (roles.includes("super_admin") || roles.includes("admin")) return next();

      // Standard authenticated actions available to all logged in users
      const standardUserPermissions = [
        "booking.create",
        "booking.read_own",
        "booking.cancel",
        "booking.read",
        "booking.read_property",
        "booking.status.update",
        "dashboard.properties.read",
        "dashboard.bookings.read",
        "dashboard.owner.bookings.read",
        "dashboard.owner.properties.read",
        "dashboard.revenue.read",
        "dashboard.reports.read",
        "dashboard.users.read",
        "dashboard.analytics.read",
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
        "profile.read",
        "profile.update",
        "favorite.create",
        "favorite.read_own",
        "favorite.delete",
        "review.create",
        "review.read_own",
        "report.create",
        "report.read_own",
        "notification.read",
        "notification.delete",
        "support_ticket.create",
        "support_ticket.read_own",
        "support_ticket.message.create",
        "recently_viewed.read",
        "recently_viewed.create",
        "rental.read_own",
      ];

      if (standardUserPermissions.includes(permissionName)) {
        return next();
      }

      const allowed = await userHasPermission(req.user.id, permissionName);
      if (!allowed) throw new AppError(req.t("common.forbidden"), 403);

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roleNames) {
  return async (req, res, next) => {
    try {
      const roles =
        req.user?.roles && Array.isArray(req.user.roles) && req.user.roles.length > 0
          ? req.user.roles
          : await getUserRoleNames(req.user.id);
      const allowed = roles.some((r) => roleNames.includes(r));
      if (!allowed) throw new AppError(req.t("common.forbidden"), 403);
      next();
    } catch (err) {
      next(err);
    }
  };
}
