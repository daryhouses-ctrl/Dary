import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  dispatchNotificationService,
  createBulkNotificationsService,
} from "./notificationServices.js";
import {
  clearDashboardReportsCache,
  getOrSetDashboardCache,
  generateDashboardKey,
  DASHBOARD_TTL,
} from "../utils/dashboardCache.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCacheByPrefix,
} from "../utils/memoryCache.js";
import { ReportApiFeatures } from "../utils/api-features.js";

const VALID_TYPES = ["property", "user", "spam", "fraud"];
const VALID_PRIORITIES = ["low", "medium", "high"];
const ADMIN_IDS_CACHE_KEY = "system:active_admin_ids";

async function getCachedActiveAdminIds() {
  const cached = getMemoryCache(ADMIN_IDS_CACHE_KEY);
  if (cached) return cached;

  const admins = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          role: {
            name: {
              in: ["admin", "super_admin"],
            },
          },
        },
      },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  const adminIds = admins.map((a) => a.id);
  setMemoryCache(ADMIN_IDS_CACHE_KEY, adminIds, 300); // Cache for 5 minutes
  return adminIds;
}

async function safelyDispatchNotification(data, context = "") {
  try {
    await dispatchNotificationService(data);
  } catch (error) {
    console.error(`[Notification Error] ${context}`, error);
  }
}

export async function createReportService(reporterId, body, t) {
  const {
    reportedType,
    reportedPropertyId,
    reportedUserId,
    description,
    priority,
  } = body;

  if (!reportedType || !VALID_TYPES.includes(reportedType)) {
    throw new AppError(t("report.invalidType"), 400);
  }

  if (priority && !VALID_PRIORITIES.includes(priority)) {
    throw new AppError(t("report.invalidPriority"), 400);
  }

  if (!reportedPropertyId && !reportedUserId) {
    throw new AppError(t("report.targetRequired"), 400);
  }

  if (reportedPropertyId && reportedUserId) {
    throw new AppError(t("report.onlyOneTargetAllowed"), 400);
  }

  if (reportedType === "property" && !reportedPropertyId) {
    throw new AppError(t("report.propertyIdRequiredForType"), 400);
  }

  if (reportedType !== "property" && !reportedUserId) {
    throw new AppError(t("report.userIdRequiredForType"), 400);
  }

  let reportedProperty = null;

  if (reportedPropertyId) {
    reportedProperty = await prisma.property.findFirst({
      where: {
        id: reportedPropertyId,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (!reportedProperty) {
      throw new AppError(t("property.notFound"), 404);
    }
  }

  let reportedUser = null;

  if (reportedUserId) {
    if (reportedUserId === reporterId) {
      throw new AppError(t("report.cannotReportSelf"), 400);
    }

    reportedUser = await prisma.user.findFirst({
      where: {
        id: reportedUserId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!reportedUser) {
      throw new AppError(t("user.notFound"), 404);
    }
  }

  const report = await prisma.report.create({
    data: {
      reporterId,
      reportedType,
      reportedPropertyId: reportedPropertyId || null,
      reportedUserId: reportedUserId || null,
      description,
      priority: priority || "medium",
      status: "PENDING",
    },
  });

  clearDashboardReportsCache();
  deleteMemoryCacheByPrefix(`user:reports:${reporterId}`);

  (async () => {
    try {
      const adminIds = await getCachedActiveAdminIds();
      if (!adminIds || adminIds.length === 0) return;

      const targetName =
        reportedProperty?.title ||
        (reportedUser
          ? `${reportedUser.firstName || ""} ${reportedUser.lastName || ""}`.trim()
          : "");

      const reportTitle = targetName
        ? `New ${reportedType} report: ${targetName}`
        : `New ${reportedType} report`;

      await createBulkNotificationsService(adminIds, {
        event: "report",
        channel: "in_app",
        title: "New Report",
        body: reportTitle,
        payload: {
          reportId: report.id,
          reporterId,
          reportedType,
          reportedPropertyId: reportedPropertyId || null,
          reportedUserId: reportedUserId || null,
          priority: report.priority,
          status: report.status,
        },
        relatedEntityType: "report",
        relatedEntityId: report.id,
      });
    } catch (error) {
      console.error(
        `[Notification Error] report ${report.id} bulk notify`,
        error,
      );
    }
  })();

  return report;
}

export async function getMyReportsService(reporterId, t) {
  const cacheKey = `user:reports:${reporterId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached) return cached;

  // Single SQL JOIN query instead of 2 sequential Prisma queries
  const reports = await prisma.$queryRaw`
    SELECT
      r.id,
      r.reporter_id AS "reporterId",
      r.reported_type AS "reportedType",
      r.reported_property_id AS "reportedPropertyId",
      r.reported_user_id AS "reportedUserId",
      r.description,
      r.priority,
      r.status,
      r.resolved_by AS "resolvedById",
      r.resolution_notes AS "resolutionNotes",
      r.created_at AS "createdAt",
      r.resolved_at AS "resolvedAt",
      CASE
        WHEN p.id IS NOT NULL THEN json_build_object('title', p.title)
        ELSE NULL
      END AS "reportedProperty"
    FROM reports r
    LEFT JOIN properties p ON p.id = r.reported_property_id
    WHERE r.reporter_id = ${reporterId}
    ORDER BY r.created_at DESC
  `;

  setMemoryCache(cacheKey, reports, 30);
  return reports;
}

export async function getReportByIdService(id, userId, isAdmin, t) {
  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      reporter: { select: { firstName: true, lastName: true, email: true } },
      reportedProperty: { select: { title: true, ownerId: true } },
      resolvedBy: { select: { firstName: true, lastName: true } },
    },
  });

  if (!report) {
    throw new AppError(t("report.notFound"), 404);
  }

  if (report.reporterId !== userId && !isAdmin) {
    throw new AppError(t("common.forbidden"), 403);
  }

  return report;
}

export async function getAllReportsService(query, t) {
  const cacheKey = generateDashboardKey("dashboard:reports:list", query);
  return getOrSetDashboardCache(cacheKey, DASHBOARD_TTL.LIST, async () => {
    const features = new ReportApiFeatures(query).filter().sort().paginate();

    const pageNum = Math.floor(features.skip / features.take) + 1;
    const limitNum = features.take;
    const skip = features.skip;

    const statusFilter = features.where.status || null;
    const typeFilter = features.where.reportedType || null;
    const priorityFilter = features.where.priority || null;

    // Single SQL roundtrip joining reporter + property + window count (replaces 4 Prisma queries)
    const rows = await prisma.$queryRaw`
      SELECT
        r.id,
        r.reporter_id AS "reporterId",
        r.reported_type AS "reportedType",
        r.reported_property_id AS "reportedPropertyId",
        r.reported_user_id AS "reportedUserId",
        r.description,
        r.priority,
        r.status,
        r.resolved_by AS "resolvedById",
        r.resolution_notes AS "resolutionNotes",
        r.created_at AS "createdAt",
        r.resolved_at AS "resolvedAt",
        CASE
          WHEN u.id IS NOT NULL THEN json_build_object(
            'firstName', u.first_name,
            'lastName', u.last_name,
            'email', u.email
          )
          ELSE NULL
        END AS "reporter",
        CASE
          WHEN p.id IS NOT NULL THEN json_build_object(
            'title', p.title
          )
          ELSE NULL
        END AS "reportedProperty",
        COUNT(*) OVER()::int AS "_totalCount"
      FROM reports r
      LEFT JOIN users u ON u.id = r.reporter_id
      LEFT JOIN properties p ON p.id = r.reported_property_id
      WHERE (${statusFilter}::text IS NULL OR r.status::text = ${statusFilter})
        AND (${typeFilter}::text IS NULL OR r.reported_type::text = ${typeFilter})
        AND (${priorityFilter}::text IS NULL OR r.priority::text = ${priorityFilter})
      ORDER BY r.priority DESC, r.created_at DESC
      LIMIT ${limitNum} OFFSET ${skip}
    `;

    let total = 0;
    if (rows.length > 0) {
      total = Number(rows[0]._totalCount || 0);
    } else if (pageNum > 1) {
      const countRes = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS "total"
        FROM reports r
        WHERE (${statusFilter}::text IS NULL OR r.status::text = ${statusFilter})
          AND (${typeFilter}::text IS NULL OR r.reported_type::text = ${typeFilter})
          AND (${priorityFilter}::text IS NULL OR r.priority::text = ${priorityFilter})
      `;
      total = Number(countRes[0]?.total || 0);
    }

    const reports = rows.map(({ _totalCount, ...report }) => report);

    return {
      data: reports,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });
}

export async function updateReportPriorityService(reportId, priority, t) {
  const normPriority =
    priority?.toLowerCase() === "urgent" ? "high" : priority?.toLowerCase();
  if (!VALID_PRIORITIES.includes(normPriority)) {
    throw new AppError(t("report.invalidPriority"), 400);
  }

  const report = await prisma.report.findUnique({
    where: {
      id: reportId,
    },
  });

  if (!report) {
    throw new AppError(t("report.notFound"), 404);
  }

  const updatedReport = await prisma.report.update({
    where: {
      id: reportId,
    },
    data: {
      priority: normPriority,
    },
  });

  clearDashboardReportsCache();
  deleteMemoryCacheByPrefix(`user:reports:${report.reporterId}`);

  return updatedReport;
}

export async function resolveReportService(
  reportId,
  adminId,
  resolutionNotes,
  t,
) {
  if (!resolutionNotes) {
    throw new AppError(t("report.resolutionNotesRequired"), 400);
  }

  const report = await prisma.report.findUnique({
    where: {
      id: reportId,
    },
  });

  if (!report) {
    throw new AppError(t("report.notFound"), 404);
  }

  if (report.status === "RESOLVED") {
    throw new AppError(t("report.alreadyResolved"), 400);
  }

  const updatedReport = await prisma.report.update({
    where: {
      id: reportId,
    },
    data: {
      status: "RESOLVED",
      resolvedById: adminId,
      resolutionNotes,
      resolvedAt: new Date(),
    },
  });

  clearDashboardReportsCache();
  deleteMemoryCacheByPrefix(`user:reports:${report.reporterId}`);

  // Dispatch notification asynchronously in background without blocking HTTP response
  safelyDispatchNotification(
    {
      userId: report.reporterId,
      event: "report",
      channel: "in_app",
      title: "Report Resolved",
      body: "Your report has been reviewed and resolved.",
      payload: {
        reportId: updatedReport.id,
        reportedType: updatedReport.reportedType,
        reportedPropertyId: updatedReport.reportedPropertyId,
        reportedUserId: updatedReport.reportedUserId,
        priority: updatedReport.priority,
        status: updatedReport.status,
        resolutionNotes: updatedReport.resolutionNotes,
        resolvedAt: updatedReport.resolvedAt,
      },
      relatedEntityType: "report",
      relatedEntityId: updatedReport.id,
    },
    `resolve report ${reportId}`,
  );

  return updatedReport;
}
