import { prisma } from "../config/prisma/PrismaService.js";
import {
  BaseApiFeatures,
  PropertyApiFeatures,
  UserApiFeatures,
  BookingCalendarApiFeatures,
} from "../utils/api-features.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  getOrSetDashboardCache,
  generateDashboardKey,
  DASHBOARD_TTL,
  clearDashboardCache,
  clearDashboardReportsCache,
  clearDashboardBookingsCache,
  clearDashboardPropertiesCache,
  clearDashboardUsersCache,
} from "../utils/dashboardCache.js";
import { deleteMemoryCacheByPrefix } from "../utils/memoryCache.js";

export {
  clearDashboardCache,
  clearDashboardReportsCache,
  clearDashboardBookingsCache,
  clearDashboardPropertiesCache,
  clearDashboardUsersCache,
};

async function attachPrimaryImages(properties) {
  if (!properties || properties.length === 0) return;
  const propertyIds = properties.map((p) => p.id).filter(Boolean);
  if (propertyIds.length === 0) return;

  const images = await prisma.propertyImage.findMany({
    where: { propertyId: { in: propertyIds } },
    orderBy: [{ isPrimary: "desc" }, { order: "asc" }, { createdAt: "asc" }],
    select: {
      propertyId: true,
      url: true,
      publicId: true,
      category: true,
      isPrimary: true,
      order: true,
    },
  });

  const imageMap = new Map();
  for (const img of images) {
    if (!imageMap.has(img.propertyId)) {
      const { propertyId, ...imgData } = img;
      imageMap.set(propertyId, [imgData]);
    }
  }

  for (const prop of properties) {
    prop.images = imageMap.get(prop.id) || [];
  }
}

export async function getReportsStatusService(t) {
  return getOrSetDashboardCache(
    "dashboard:reports:status",
    DASHBOARD_TTL.STATS,
    async () => {
      const result = await prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pending",
          COUNT(*) FILTER (WHERE status = 'RESOLVED')::int AS "resolved",
          COUNT(*) FILTER (WHERE status = 'PENDING' AND priority = 'high')::int AS "highPriority"
        FROM reports
      `;

      const row = result[0] || {};
      return {
        total: Number(row.total || 0),
        pending: Number(row.pending || 0),
        resolved: Number(row.resolved || 0),
        highPriority: Number(row.highPriority || 0),
      };
    },
  );
}

export async function getBookingsStatusService(t) {
  return getOrSetDashboardCache(
    "dashboard:bookings:status",
    DASHBOARD_TTL.STATS,
    async () => {
      const result = await prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pending",
          COUNT(*) FILTER (WHERE status = 'CONTACTED')::int AS "contacted",
          COUNT(*) FILTER (WHERE status = 'CONFIRMED')::int AS "confirmed",
          COUNT(*) FILTER (WHERE status = 'CLOSED')::int AS "closed",
          COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS "cancelled"
        FROM bookings
      `;

      const row = result[0] || {};
      return {
        total: Number(row.total || 0),
        pending: Number(row.pending || 0),
        contacted: Number(row.contacted || 0),
        confirmed: Number(row.confirmed || 0),
        closed: Number(row.closed || 0),
        cancelled: Number(row.cancelled || 0),
      };
    },
  );
}

export async function getBookingsRevenueService(t) {
  return getOrSetDashboardCache(
    "dashboard:bookings:revenue",
    DASHBOARD_TTL.STATS,
    async () => {
      const result = await prisma.$queryRaw`
        SELECT
          COALESCE(
            SUM(COALESCE(b.total_price, b.beds_requested * pr.price_per_bed))
            FILTER (WHERE b.status = 'CLOSED'),
            0
          )::float AS "totalRevenue",
          COALESCE(
            SUM(COALESCE(b.total_price, b.beds_requested * pr.price_per_bed))
            FILTER (WHERE b.status IN ('PENDING', 'CONTACTED', 'CONFIRMED')),
            0
          )::float AS "pendingRevenue"
        FROM bookings b
        LEFT JOIN property_rooms pr ON pr.id = b.room_id
      `;

      return {
        totalRevenue: Number(result[0]?.totalRevenue ?? 0),
        pendingRevenue: Number(result[0]?.pendingRevenue ?? 0),
      };
    },
  );
}

export async function getPropertiesStatusService(t) {
  return getOrSetDashboardCache(
    "dashboard:properties:status",
    DASHBOARD_TTL.STATS,
    async () => {
      const result = await prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS "total",
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pending",
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "approved",
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS "rejected",
          COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int AS "suspended",
          COUNT(*) FILTER (WHERE status = 'ARCHIVED')::int AS "archived",
          COUNT(*) FILTER (WHERE status = 'APPROVED' AND is_available = true)::int AS "available",
          COUNT(*) FILTER (WHERE status = 'APPROVED' AND is_available = false)::int AS "full"
        FROM properties
        WHERE deleted_at IS NULL
      `;

      const row = result[0] || {};
      return {
        total: Number(row.total || 0),
        pending: Number(row.pending || 0),
        approved: Number(row.approved || 0),
        rejected: Number(row.rejected || 0),
        suspended: Number(row.suspended || 0),
        archived: Number(row.archived || 0),
        available: Number(row.available || 0),
        full: Number(row.full || 0),
      };
    },
  );
}

export async function getUsersStatusService(t) {
  return getOrSetDashboardCache(
    "dashboard:users:status",
    DASHBOARD_TTL.STATS,
    async () => {
      const result = await prisma.$queryRaw`
        WITH user_counts AS (
          SELECT
            COUNT(*)::int AS "total",
            COUNT(*) FILTER (WHERE status = 'ACTIVE')::int AS "active",
            COUNT(*) FILTER (WHERE status = 'INACTIVE')::int AS "inactive",
            COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pending",
            COUNT(*) FILTER (WHERE status = 'SUSPENDED')::int AS "suspended"
          FROM users
          WHERE deleted_at IS NULL
        ),
        role_counts AS (
          SELECT
            COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'admin')::int AS "admins",
            COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'super_admin')::int AS "superAdmins",
            COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'owner')::int AS "owners",
            COUNT(DISTINCT ur.user_id) FILTER (WHERE r.name = 'tenant')::int AS "tenants"
          FROM user_roles ur
          JOIN roles r ON ur.role_id = r.id
          JOIN users u ON ur.user_id = u.id AND u.deleted_at IS NULL
        )
        SELECT * FROM user_counts, role_counts
      `;

      const row = result[0] || {};
      return {
        total: Number(row.total || 0),
        active: Number(row.active || 0),
        inactive: Number(row.inactive || 0),
        pending: Number(row.pending || 0),
        suspended: Number(row.suspended || 0),
        admins: Number(row.admins || 0),
        superAdmins: Number(row.superAdmins || 0),
        owners: Number(row.owners || 0),
        tenants: Number(row.tenants || 0),
      };
    },
  );
}

export async function getDashboardUsersService(query, t) {
  const cacheKey = generateDashboardKey("dashboard:users:list", query);
  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.LIST, async () => {
    const { role, status, search } = query;

    const features = new UserApiFeatures(query).filter().sort().paginate();

    const pageNumber = Math.floor(features.skip / features.take) + 1;
    const limitNumber = features.take;
    const skip = features.skip;
    const where = features.where;
    const trimmedSearch = search?.trim();

    const sortField = Object.keys(features.orderBy)[0] || "createdAt";
    const sortOrder = features.orderBy[sortField] || "desc";

    let data;
    let total;

    if (!trimmedSearch && !role && !status && sortField === "createdAt") {
      const [rawUsers, countResult] = await Promise.all([
        sortOrder === "asc"
          ? prisma.$queryRaw`
            SELECT 
              u.id, 
              u.first_name AS "firstName", 
              u.last_name AS "lastName", 
              u.email, 
              u.phone, 
              u.whatsapp_phone AS "whatsappPhone", 
              u.avatar, 
              u.status, 
              u.created_at AS "createdAt",
              p.city,
              COALESCE(ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
            FROM (
              SELECT id, first_name, last_name, email, phone, whatsapp_phone, avatar, status, created_at
              FROM users
              WHERE deleted_at IS NULL
              ORDER BY created_at ASC
              LIMIT ${limitNumber} OFFSET ${skip}
            ) u
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.whatsapp_phone, u.avatar, u.status, u.created_at, p.city
            ORDER BY u.created_at ASC
          `
          : prisma.$queryRaw`
            SELECT 
              u.id, 
              u.first_name AS "firstName", 
              u.last_name AS "lastName", 
              u.email, 
              u.phone, 
              u.whatsapp_phone AS "whatsappPhone", 
              u.avatar, 
              u.status, 
              u.created_at AS "createdAt",
              p.city,
              COALESCE(ARRAY_AGG(r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles
            FROM (
              SELECT id, first_name, last_name, email, phone, whatsapp_phone, avatar, status, created_at
              FROM users
              WHERE deleted_at IS NULL
              ORDER BY created_at DESC
              LIMIT ${limitNumber} OFFSET ${skip}
            ) u
            LEFT JOIN profiles p ON p.user_id = u.id
            LEFT JOIN user_roles ur ON ur.user_id = u.id
            LEFT JOIN roles r ON ur.role_id = r.id
            GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.whatsapp_phone, u.avatar, u.status, u.created_at, p.city
            ORDER BY u.created_at DESC
          `,
        prisma.user.count({ where }),
      ]);

      total = countResult;
      data = rawUsers.map((u) => {
        const roles = Array.isArray(u.roles) ? u.roles : [];
        let primaryRole = roles[0] || "tenant";
        if (roles.includes("super_admin")) primaryRole = "super_admin";
        else if (roles.includes("admin")) primaryRole = "admin";
        else if (roles.includes("owner")) primaryRole = "owner";
        else if (roles.includes("tenant")) primaryRole = "tenant";

        return {
          id: u.id,
          firstName: u.firstName,
          lastName: u.lastName,
          email: u.email,
          phone: u.phone,
          whatsappPhone: u.whatsappPhone,
          avatar: u.avatar,
          status: u.status,
          createdAt: u.createdAt,
          city: u.city ?? null,
          role: primaryRole,
          roles,
        };
      });
    } else {
      const execResult = await features.execute(prisma.user, {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          whatsappPhone: true,
          avatar: true,
          status: true,
          createdAt: true,

          profile: {
            select: {
              city: true,
            },
          },

          userRoles: {
            select: {
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      });

      total = execResult.meta.total;
      data = execResult.data.map((user) => {
        const roles = user.userRoles?.map(({ role }) => role.name) ?? [];

        let primaryRole = roles[0] || "tenant";

        if (roles.includes("super_admin")) {
          primaryRole = "super_admin";
        } else if (roles.includes("admin")) {
          primaryRole = "admin";
        } else if (roles.includes("owner")) {
          primaryRole = "owner";
        } else if (roles.includes("tenant")) {
          primaryRole = "tenant";
        }

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          whatsappPhone: user.whatsappPhone,
          avatar: user.avatar,
          status: user.status,
          createdAt: user.createdAt,
          city: user.profile?.city ?? null,
          role: primaryRole,
          roles,
        };
      });
    }

    return {
      data,
      meta: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber),
        hasNextPage: pageNumber * limitNumber < total,
        hasPreviousPage: pageNumber > 1,
      },
    };
  });
}

export async function getDashboardPropertiesService(query, t) {
  const cacheKey = generateDashboardKey("dashboard:properties:list", query);
  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.LIST, async () => {
    const features = new PropertyApiFeatures(query).filter().sort().paginate();

    const result = await features.execute(prisma.property, {
      select: {
        id: true,
        title: true,
        description: true,
        governorate: true,
        city: true,
        district: true,
        address: true,
        latitude: true,
        longitude: true,
        propertyType: true,
        propertyClass: true,
        targetTenantType: true,
        genderAllowed: true,
        rooms: true,
        startingPrice: true,
        isFurnished: true,
        electricityIncluded: true,
        waterIncluded: true,
        internetIncluded: true,
        amenities: true,
        status: true,
        rejectionReason: true,
        isVerified: true,
        isAvailable: true,
        viewsCount: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      data: result.data,
      meta: result.meta,
    };
  });
}

function getStartDate(range) {
  const now = new Date();

  switch (range) {
    case "7d":
      return new Date(now.getTime() - 7 * 86400000);
    case "30d":
      return new Date(now.getTime() - 30 * 86400000);
    case "90d":
      return new Date(now.getTime() - 90 * 86400000);
    case "1y":
      return new Date(now.getTime() - 365 * 86400000);
    default:
      return new Date(now.getTime() - 30 * 86400000);
  }
}

async function getUserDistribution() {
  const rows = await prisma.$queryRaw`
    SELECT r.name, COUNT(ur.user_id)::int AS count
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN users u ON ur.user_id = u.id
    WHERE u.deleted_at IS NULL
      AND r.name IN ('super_admin', 'admin', 'owner', 'tenant')
    GROUP BY r.name
  `;

  const distribution = {
    super_admin: 0,
    admin: 0,
    owner: 0,
    tenant: 0,
  };

  for (const row of rows) {
    if (distribution[row.name] !== undefined) {
      distribution[row.name] = Number(row.count);
    }
  }

  return distribution;
}

async function getUserGrowth(startDate, endDate, role) {
  let rows;

  if (role) {
    const roleCondition = role === "admin" ? ["admin", "super_admin"] : [role];
    rows = await prisma.$queryRaw`
      SELECT TO_CHAR(u.created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.deleted_at IS NULL
        AND u.created_at >= ${startDate}
        AND u.created_at <= ${endDate}
        AND r.name = ANY(${roleCondition})
      GROUP BY TO_CHAR(u.created_at, 'YYYY-MM-DD')
      ORDER BY date ASC
    `;
  } else {
    rows = await prisma.$queryRaw`
      SELECT TO_CHAR(u.created_at, 'YYYY-MM-DD') AS date, COUNT(*)::int AS count
      FROM users u
      WHERE u.deleted_at IS NULL
        AND u.created_at >= ${startDate}
        AND u.created_at <= ${endDate}
      GROUP BY TO_CHAR(u.created_at, 'YYYY-MM-DD')
      ORDER BY date ASC
    `;
  }

  return rows.map((row) => ({
    date: row.date,
    count: Number(row.count),
  }));
}

async function getEstimatedRevenue(startDate, endDate) {
  const result = await prisma.$queryRaw`
    SELECT COALESCE(
      SUM(b.beds_requested * pr.price_per_bed),
      0
    ) AS revenue
    FROM bookings b
    INNER JOIN property_rooms pr
      ON pr.id = b.room_id
    WHERE b.status = 'CLOSED'
      AND b.created_at >= ${startDate}
      AND b.created_at <= ${endDate}
  `;

  return Number(result[0]?.revenue ?? 0);
}

async function getTotalPropertyViews() {
  const result = await prisma.property.aggregate({
    where: { deletedAt: null },
    _sum: { viewsCount: true },
  });

  return result._sum.viewsCount ?? 0;
}

export async function getAnalyticsService(query, t) {
  const { range = "30d", role } = query;
  const cacheKey = `dashboard:analytics:${range}:${role || "all"}`;

  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.ANALYTICS, async () => {
    const startDate = getStartDate(range);
    const endDate = new Date();

    const userWhere = {
      deletedAt: null,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (role) {
      userWhere.userRoles = {
        some: {
          role: {
            name: role === "admin" ? { in: ["admin", "super_admin"] } : role,
          },
        },
      };
    }

    const [
      newUsers,
      propStats,
      bookingStats,
      userGrowth,
      userDistribution,
      bedsAggregate,
    ] = await Promise.all([
      prisma.user.count({ where: userWhere }),

      prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= ${startDate} AND created_at <= ${endDate})::int AS "newProperties",
          COALESCE(SUM(views_count), 0)::int AS "views"
        FROM properties
        WHERE deleted_at IS NULL
      `,

      prisma.$queryRaw`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= ${startDate} AND created_at <= ${endDate})::int AS "totalBookingsCount",
          COUNT(*) FILTER (WHERE status IN ('CONTACTED', 'CONFIRMED', 'CLOSED'))::int AS "activeBookingsCount",
          COALESCE(SUM(total_price) FILTER (WHERE status = 'CLOSED' AND created_at >= ${startDate} AND created_at <= ${endDate}), 0)::float AS "revenue"
        FROM bookings
      `,

      getUserGrowth(startDate, endDate, role),
      getUserDistribution(),

      prisma.propertyRoom.aggregate({
        where: {
          property: { deletedAt: null },
        },
        _sum: {
          totalBeds: true,
          availableBeds: true,
        },
      }),
    ]);

    const newProperties = Number(propStats[0]?.newProperties || 0);
    const views = Number(propStats[0]?.views || 0);
    const totalBookingsCount = Number(bookingStats[0]?.totalBookingsCount || 0);
    const activeBookingsCount = Number(
      bookingStats[0]?.activeBookingsCount || 0,
    );
    const revenue = Number(bookingStats[0]?.revenue || 0);

    const totalBeds = bedsAggregate._sum.totalBeds || 10;
    const availableBeds =
      bedsAggregate._sum.availableBeds !== null
        ? bedsAggregate._sum.availableBeds
        : 5;
    const occupiedBeds = Math.max(0, totalBeds - availableBeds);
    const occupancyRate = Math.min(
      100,
      Math.max(0, Math.round((occupiedBeds / totalBeds) * 100)),
    );
    const bookingVolume = totalBookingsCount || activeBookingsCount || 0;
    const dau =
      Math.max(newUsers, Math.round((views || 0) / 7)) ||
      (newUsers > 0 ? newUsers : 1);
    const totalGrowthCount = userGrowth.reduce(
      (sum, item) => sum + item.count,
      0,
    );

    return {
      range,
      period: {
        startDate,
        endDate,
      },
      occupancyRate,
      dailyActiveUsers: dau,
      bookingVolume,
      userGrowth: totalGrowthCount,
      growthRate: totalGrowthCount,
      totalRevenue: revenue,
      summary: {
        revenue,
        newUsers,
        newProperties,
        views,
        occupancyRate,
        dailyActiveUsers: dau,
        bookingVolume,
      },
      userGrowth,
      userDistribution,
    };
  });
}

export async function addRecentlyViewedPropertyService(userId, propertyId, t) {
  const property = await prisma.property.findFirst({
    where: {
      id: propertyId,
      deletedAt: null,
      status: "APPROVED",
    },
    select: { id: true },
  });

  if (!property) {
    throw new AppError(t("property.notFound"), 404);
  }

  return prisma.recentlyViewed.upsert({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
    update: {
      viewedAt: new Date(),
    },
    create: {
      userId,
      propertyId,
      viewedAt: new Date(),
    },
  });
  deleteMemoryCacheByPrefix(`dashboard:recently-viewed:${userId}`);
}

export async function getMyRecentlyViewedPropertiesService(
  userId,
  page = 1,
  limit = 20,
) {
  const cacheKey = `dashboard:recently-viewed:${userId}:${page}:${limit}`;
  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.LIST, async () => {
    const features = new BaseApiFeatures(
      { page, limit },
      {
        defaultWhere: {
          userId,
          property: {
            deletedAt: null,
            status: "APPROVED",
          },
        },
        defaultOrderBy: { viewedAt: "desc" },
        defaultLimit: 20,
      },
    ).paginate();

    const execResult = await features.execute(prisma.recentlyViewed, {
      select: {
        viewedAt: true,
        property: {
          select: {
            id: true,
            title: true,
            description: true,
            governorate: true,
            city: true,
            district: true,
            address: true,
            latitude: true,
            longitude: true,
            propertyType: true,
            propertyClass: true,
            targetTenantType: true,
            genderAllowed: true,
            rooms: true,
            startingPrice: true,
            isFurnished: true,
            electricityIncluded: true,
            waterIncluded: true,
            internetIncluded: true,
            amenities: true,
            status: true,
            isVerified: true,
            isAvailable: true,
            viewsCount: true,
            rooms_: {
              select: {
                id: true,
                roomType: true,
                pricePerBed: true,
                totalBeds: true,
                availableBeds: true,
                status: true,
              },
            },
          },
        },
      },
    });

    const items = execResult.data;

    // Batch load primary images for all properties to avoid N+1 queries
    const properties = items.map((item) => item.property).filter(Boolean);
    await attachPrimaryImages(properties);

    return {
      data: items.map((item) => ({
        ...item.property,
        viewedAt: item.viewedAt,
      })),
      meta: execResult.meta,
    };
  });
}

export async function removeRecentlyViewedPropertyService(
  userId,
  propertyId,
  t,
) {
  const existing = await prisma.recentlyViewed.findUnique({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    throw new AppError(t("property.notFound"), 404);
  }

  await prisma.recentlyViewed.delete({
    where: {
      userId_propertyId: {
        userId,
        propertyId,
      },
    },
  });

  deleteMemoryCacheByPrefix(`dashboard:recently-viewed:${userId}`);

  return {
    propertyId,
    message: "Recently viewed property removed successfully",
  };
}

export async function clearRecentlyViewedPropertiesService(userId) {
  const result = await prisma.recentlyViewed.deleteMany({
    where: { userId },
  });

  deleteMemoryCacheByPrefix(`dashboard:recently-viewed:${userId}`);

  return {
    deletedCount: result.count,
    message: "Recently viewed properties cleared successfully",
  };
}

export async function getMyRentalsService(userId, page = 1, limit = 20) {
  const cacheKey = `dashboard:rentals:${userId}:${page}:${limit}`;
  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.LIST, async () => {
    const features = new BaseApiFeatures(
      { page, limit },
      {
        defaultWhere: {
          tenantId: userId,
        },
        defaultOrderBy: { createdAt: "desc" },
        defaultLimit: 20,
      },
    ).paginate();

    const execResult = await features.execute(prisma.booking, {
      select: {
        id: true,
        status: true,
        bedsRequested: true,
        startDate: true,
        endDate: true,
        totalPrice: true,
        monthsCount: true,
        note: true,
        createdAt: true,
        updatedAt: true,
        contactedAt: true,

        property: {
          select: {
            id: true,
            title: true,
            description: true,
            governorate: true,
            city: true,
            district: true,
            address: true,
            propertyType: true,
            propertyClass: true,
            targetTenantType: true,
            genderAllowed: true,
            startingPrice: true,
            isFurnished: true,
            isAvailable: true,
          },
        },

        room: {
          select: {
            id: true,
            roomType: true,
            pricePerBed: true,
            totalBeds: true,
            availableBeds: true,
            status: true,
          },
        },

        contract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            draftPdfUrl: true,
            tenantSignedPdfUrl: true,
            ownerSignedPdfUrl: true,
            tenantSignedAt: true,
            ownerSignedAt: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    const bookings = execResult.data;

    // Batch load cover images to eliminate N+1 queries
    const properties = bookings.map((b) => b.property).filter(Boolean);
    await attachPrimaryImages(properties);

    return {
      data: bookings,
      meta: execResult.meta,
    };
  });
}

export async function getOwnerPropertiesStatusService(ownerId, t) {
  const cacheKey = `dashboard:owner:${ownerId}:properties:status`;

  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.STATS, async () => {
    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "totalProperties",
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "underReview",
        COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "published",
        COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS "rejected"
      FROM properties
      WHERE owner_id = ${ownerId}
        AND deleted_at IS NULL
    `;

    const row = result[0] || {};
    return {
      totalProperties: Number(row.totalProperties || 0),
      underReview: Number(row.underReview || 0),
      published: Number(row.published || 0),
      rejected: Number(row.rejected || 0),
    };
  });
}

export async function getOwnerBookingsStatusService(ownerId, t) {
  const cacheKey = `dashboard:owner:${ownerId}:bookings:status`;

  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.STATS, async () => {
    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "total",
        COUNT(*) FILTER (WHERE b.status = 'PENDING')::int AS "pending",
        COUNT(*) FILTER (WHERE b.status = 'CONTACTED')::int AS "contacted",
        COUNT(*) FILTER (WHERE b.status = 'CONFIRMED')::int AS "confirmed",
        COUNT(*) FILTER (WHERE b.status = 'CLOSED')::int AS "closed",
        COUNT(*) FILTER (WHERE b.status = 'CANCELLED')::int AS "cancelled"
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE p.owner_id = ${ownerId}
        AND p.deleted_at IS NULL
    `;

    const row = result[0] || {};
    return {
      total: Number(row.total || 0),
      pending: Number(row.pending || 0),
      contacted: Number(row.contacted || 0),
      confirmed: Number(row.confirmed || 0),
      closed: Number(row.closed || 0),
      cancelled: Number(row.cancelled || 0),
    };
  });
}

export async function getOwnerBookingCalendarSummaryService(ownerId, query, t) {
  const { days = 30 } = query;

  const parsedDays = Number(days);

  if (!Number.isInteger(parsedDays) || parsedDays <= 0 || parsedDays > 365) {
    throw new AppError(t("booking.invalidDays"), 400);
  }

  const cacheKey = `dashboard:owner:${ownerId}:calendar:summary:${parsedDays}`;

  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.CALENDAR, async () => {
    const now = new Date();
    const upcomingEndDate = new Date(now);
    upcomingEndDate.setDate(upcomingEndDate.getDate() + parsedDays);

    const totalWhere = {
      property: {
        ownerId,
        deletedAt: null,
      },
      status: { not: "CANCELLED" },
    };

    const [statsResult, bookings] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COUNT(*)::int AS "totalBookings",
          COUNT(*) FILTER (WHERE b.start_date <= ${now} AND b.end_date > ${now})::int AS "activeBookings",
          COUNT(*) FILTER (WHERE b.start_date > ${now})::int AS "upcomingBookings",
          COUNT(*) FILTER (WHERE b.end_date > ${now} AND b.end_date <= ${upcomingEndDate})::int AS "expiringSoon",
          COALESCE(SUM(b.beds_requested) FILTER (WHERE b.status = 'CLOSED' AND b.start_date <= ${now} AND b.end_date > ${now}), 0)::int AS "occupiedBeds",
          COALESCE(SUM(b.total_price) FILTER (WHERE b.status = 'CLOSED' AND b.start_date <= ${now} AND b.end_date > ${now}), 0)::float AS "activeRevenue"
        FROM bookings b
        JOIN properties p ON b.property_id = p.id
        WHERE b.status != 'CANCELLED'
          AND p.deleted_at IS NULL
          AND p.owner_id = ${ownerId}
      `,

      prisma.booking.findMany({
        where: totalWhere,
        orderBy: { startDate: "asc" },
        take: 25,
        select: {
          id: true,
          startDate: true,
          endDate: true,
          bedsRequested: true,
          totalPrice: true,
          status: true,
          tenant: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              whatsappPhone: true,
              avatar: true,
            },
          },
          property: {
            select: {
              id: true,
              title: true,
              city: true,
              address: true,
            },
          },
          room: {
            select: {
              id: true,
              roomType: true,
              pricePerBed: true,
            },
          },
          contract: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const summary = statsResult[0] || {};

    return {
      activeBookings: Number(summary.activeBookings || 0),
      upcomingBookings: Number(summary.upcomingBookings || 0),
      expiringSoon: Number(summary.expiringSoon || 0),
      totalBookings: Number(summary.totalBookings || 0),
      occupiedBeds: Number(summary.occupiedBeds || 0),
      activeRevenue: Number(summary.activeRevenue || 0),
      bookings,
      meta: {
        now,
        expiringWithinDays: parsedDays,
      },
    };
  });
}

export async function getOwnerBookingsRevenueService(ownerId, t) {
  const cacheKey = `dashboard:owner:${ownerId}:bookings:revenue`;

  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.STATS, async () => {
    const [statsResult, propertyCount] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          COALESCE(SUM(b.total_price) FILTER (WHERE b.status = 'CLOSED'), 0)::float AS "totalRevenue",
          COALESCE(SUM(b.total_price) FILTER (WHERE b.status IN ('PENDING', 'CONTACTED', 'CONFIRMED')), 0)::float AS "pendingRevenue",
          COUNT(*) FILTER (WHERE b.status = 'CLOSED')::int AS "completedCount",
          COUNT(*) FILTER (WHERE b.status IN ('PENDING', 'CONTACTED', 'CONFIRMED'))::int AS "pendingCount"
        FROM bookings b
        JOIN properties p ON b.property_id = p.id
        WHERE p.owner_id = ${ownerId}
          AND p.deleted_at IS NULL
      `,
      prisma.property.count({
        where: { ownerId, deletedAt: null },
      }),
    ]);

    const stats = statsResult[0] || {};
    const totalRevenue = Number(stats.totalRevenue || 0);
    const pendingRevenue = Number(stats.pendingRevenue || 0);
    const completedCount = Number(stats.completedCount || 0);
    const pendingCount = Number(stats.pendingCount || 0);
    const avgRevenuePerProperty =
      propertyCount > 0 ? Math.round(totalRevenue / propertyCount) : 0;

    return {
      totalRevenue,
      pendingRevenue,
      completedBookings: completedCount,
      pendingBookings: pendingCount,
      totalProperties: propertyCount,
      avgRevenuePerProperty,
      currency: "ج.م",
    };
  });
}

export async function getBookingsCalendarService(query, t) {
  const { startDate, endDate } = query;

  if (startDate && endDate) {
    const parsedStartDate = new Date(startDate);
    const parsedEndDate = new Date(endDate);

    if (
      Number.isNaN(parsedStartDate.getTime()) ||
      Number.isNaN(parsedEndDate.getTime())
    ) {
      throw new AppError(t("booking.invalidDates"), 400);
    }

    if (parsedStartDate >= parsedEndDate) {
      throw new AppError(t("booking.invalidDateRange"), 400);
    }
  }

  const cacheKey = generateDashboardKey("dashboard:calendar:range", query);

  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.CALENDAR, async () => {
    const features = new BookingCalendarApiFeatures(query)
      .filter()
      .sort()
      .paginate();

    const result = await features.execute(prisma.booking);

    const bookingsList = result.data || [];
    bookingsList.bookings = bookingsList;
    bookingsList.meta = {
      total: result.totalCount,
      page: result.currentPage,
      limit: features.take,
      totalPages: result.totalPages,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      nextCursor: result.nextCursor,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
    };

    return {
      data: bookingsList,
      bookings: bookingsList,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
      totalCount: result.totalCount,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
      nextCursor: result.nextCursor,
      meta: {
        total: result.totalCount,
        page: result.currentPage,
        limit: features.take,
        totalPages: result.totalPages,
        hasNextPage: result.hasNextPage,
        hasPrevPage: result.hasPrevPage,
        nextCursor: result.nextCursor,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      },
    };
  });
}

export async function getBookingCalendarSummaryService(query, t) {
  const { days = 30 } = query;

  const parsedDays = Number(days);

  if (!Number.isInteger(parsedDays) || parsedDays <= 0 || parsedDays > 365) {
    throw new AppError(t("booking.invalidDays"), 400);
  }

  const cacheKey = `dashboard:calendar:summary:${parsedDays}`;

  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.CALENDAR, async () => {
    const now = new Date();
    const upcomingEndDate = new Date(now);
    upcomingEndDate.setDate(upcomingEndDate.getDate() + parsedDays);

    const result = await prisma.$queryRaw`
      SELECT
        COUNT(*)::int AS "totalBookings",
        COUNT(*) FILTER (WHERE b.start_date <= ${now} AND b.end_date > ${now})::int AS "activeBookings",
        COUNT(*) FILTER (WHERE b.start_date > ${now})::int AS "upcomingBookings",
        COUNT(*) FILTER (WHERE b.end_date > ${now} AND b.end_date <= ${upcomingEndDate})::int AS "expiringSoon",
        COALESCE(SUM(b.beds_requested) FILTER (WHERE b.status = 'CLOSED' AND b.start_date <= ${now} AND b.end_date > ${now}), 0)::int AS "occupiedBeds",
        COALESCE(SUM(b.total_price) FILTER (WHERE b.status = 'CLOSED' AND b.start_date <= ${now} AND b.end_date > ${now}), 0)::float AS "activeRevenue"
      FROM bookings b
      JOIN properties p ON b.property_id = p.id
      WHERE b.status != 'CANCELLED'
        AND p.deleted_at IS NULL
    `;

    const summary = result[0] || {};

    return {
      activeBookings: Number(summary.activeBookings || 0),
      upcomingBookings: Number(summary.upcomingBookings || 0),
      expiringSoon: Number(summary.expiringSoon || 0),
      totalBookings: Number(summary.totalBookings || 0),
      occupiedBeds: Number(summary.occupiedBeds || 0),
      activeRevenue: Number(summary.activeRevenue || 0),
      meta: {
        now,
        expiringWithinDays: parsedDays,
      },
    };
  });
}
