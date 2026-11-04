import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCacheByPrefix,
} from "../utils/memoryCache.js";
import { NotificationApiFeatures } from "../utils/api-features.js";

const inFlightNotifications = new Map();

export function clearUserNotificationsCache(userId) {
  if (userId) {
    deleteMemoryCacheByPrefix(`user:notifications:${userId}`);
  }
}

export async function createNotificationService({
  userId,
  event,
  channel,
  title,
  body,
  payload,
  relatedEntityType,
  relatedEntityId,
}) {
  const result = await prisma.notification.create({
    data: {
      userId,
      event,
      channel,
      title,
      body,
      payload: payload || undefined,
      relatedEntityType,
      relatedEntityId,
    },
  });
  clearUserNotificationsCache(userId);
  return result;
}

export async function dispatchNotificationService({
  userId,
  event,
  channel,
  title,
  body,
  payload,
  relatedEntityType,
  relatedEntityId,
}) {
  return createNotificationService({
    userId,
    event,
    channel,
    title,
    body,
    payload,
    relatedEntityType,
    relatedEntityId,
  });
}

export async function createBulkNotificationsService(userIds, data) {
  const result = await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      event: data.event,
      channel: data.channel,
      title: data.title,
      body: data.body,
      payload: data.payload || undefined,
      relatedEntityType: data.relatedEntityType,
      relatedEntityId: data.relatedEntityId,
    })),
  });
  for (const uid of userIds) {
    clearUserNotificationsCache(uid);
  }
  return result;
}

export async function markAsDeliveredService(notificationId) {
  return prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      isDelivered: true,
    },
  });
}

export async function getMyNotificationsService(userId, query, t) {
  const features = new NotificationApiFeatures(query, { userId })
    .filter()
    .sort()
    .paginate();

  const pageNumber = Math.floor(features.skip / features.take) + 1;
  const limitNumber = features.take;
  const isReadParam = query.isRead;
  const eventParam = query.event || "";

  const cacheKey = `user:notifications:${userId}:${pageNumber}:${limitNumber}:${isReadParam !== undefined ? isReadParam : ""}:${eventParam}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  if (inFlightNotifications.has(cacheKey)) {
    return inFlightNotifications.get(cacheKey);
  }

  const promise = (async () => {
    try {
      let notifications;
      let total;
      let unreadCount;

      if (isReadParam === undefined && !eventParam) {
        const [items, counts] = await Promise.all([
          prisma.notification.findMany({
            where: features.where,
            orderBy: features.orderBy,
            skip: features.skip,
            take: features.take,
          }),
          prisma.$queryRaw`
            SELECT
              COUNT(*)::int AS "total",
              COUNT(*) FILTER (WHERE is_read = false)::int AS "unreadCount"
            FROM notifications
            WHERE user_id = ${userId}
          `,
        ]);

        notifications = items;
        total = Number(counts[0]?.total || 0);
        unreadCount = Number(counts[0]?.unreadCount || 0);
      } else {
        const [execResult, unreadRes] = await Promise.all([
          features.execute(prisma.notification),
          prisma.notification.count({
            where: {
              userId,
              isRead: false,
            },
          }),
        ]);

        notifications = execResult.data;
        total = execResult.meta.total;
        unreadCount = unreadRes;
      }

      const result = {
        data: notifications,
        meta: {
          total,
          unreadCount,
          page: pageNumber,
          limit: limitNumber,
          totalPages: Math.ceil(total / limitNumber),
        },
      };

      setMemoryCache(cacheKey, result, 30);
      return result;
    } finally {
      inFlightNotifications.delete(cacheKey);
    }
  })();

  inFlightNotifications.set(cacheKey, promise);
  return promise;
}

export async function markAsReadService(notificationId, userId, t) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new AppError(t("notification.notFound"), 404);
  }

  if (notification.isRead) {
    return notification;
  }

  const updated = await prisma.notification.update({
    where: {
      id: notificationId,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  clearUserNotificationsCache(userId);
  return updated;
}

export async function markAllAsReadService(userId, t) {
  await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  clearUserNotificationsCache(userId);

  return {
    success: true,
  };
}

export async function deleteNotificationService(notificationId, userId, t) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new AppError(t("notification.notFound"), 404);
  }

  await prisma.notification.delete({
    where: {
      id: notificationId,
    },
  });

  clearUserNotificationsCache(userId);

  return {
    success: true,
  };
}

export async function deleteAllReadService(userId, t) {
  await prisma.notification.deleteMany({
    where: {
      userId,
      isRead: true,
    },
  });

  clearUserNotificationsCache(userId);

  return {
    success: true,
  };
}
