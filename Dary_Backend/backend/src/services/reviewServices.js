import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCacheByPrefix,
} from "../utils/memoryCache.js";
import { ReviewApiFeatures } from "../utils/api-features.js";

const inFlightReviews = new Map();

function clearReviewsCache() {
  deleteMemoryCacheByPrefix("reviews:");
}

// Create Review (Tenant) مش هيعرف يعمله الا لما تخلص حجز ف اخر التجربه
export async function createReviewService(tenantId, body, t) {
  const { bookingId, propertyRating, ownerRating, comment } = body;

  if (!bookingId || !propertyRating || !ownerRating) {
    throw new AppError(t("review.missingFields"), 400);
  }

  if (
    propertyRating < 1 ||
    propertyRating > 5 ||
    ownerRating < 1 ||
    ownerRating > 5
  ) {
    throw new AppError(t("review.invalidRatingRange"), 400);
  }

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, tenantId },
    include: {
      property: { select: { id: true, ownerId: true } },
      review: true,
    },
  });

  if (!booking) {
    throw new AppError(t("booking.notFound"), 404);
  }

  if (booking.status !== "CLOSED") {
    throw new AppError(t("review.bookingNotClosed"), 400);
  }

  if (booking.review) {
    throw new AppError(t("review.alreadyReviewed"), 400);
  }

  const review = await prisma.review.create({
    data: {
      bookingId,
      propertyId: booking.property.id,
      ownerId: booking.property.ownerId,
      tenantId,
      propertyRating,
      ownerRating,
      comment,
      status: "PENDING",
    },
  });

  clearReviewsCache();

  return review;
}

// Get Property Reviews
export async function getPropertyReviewsService(propertyId, query = {}, t) {
  const features = new ReviewApiFeatures(query, {
    propertyId,
    status: "APPROVED",
  })
    .filter()
    .sort()
    .paginate();

  const page = Math.floor(features.skip / features.take) + 1;
  const limit = features.take;
  const cacheKey = `reviews:property:${propertyId}:${page}:${limit}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  if (inFlightReviews.has(cacheKey)) {
    return inFlightReviews.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const [reviews, aggregates] = await Promise.all([
        prisma.review.findMany({
          where: features.where,
          include: {
            tenant: {
              select: { firstName: true, lastName: true, avatar: true },
            },
          },
          orderBy: features.orderBy,
          skip: features.skip,
          take: features.take,
        }),
        prisma.review.aggregate({
          where: features.where,
          _avg: { propertyRating: true, ownerRating: true },
          _count: true,
        }),
      ]);

      const total = aggregates._count || 0;

      const result = {
        data: reviews,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          averagePropertyRating: aggregates._avg?.propertyRating || 0,
          averageOwnerRating: aggregates._avg?.ownerRating || 0,
        },
      };

      setMemoryCache(cacheKey, result, 60);
      return result;
    } finally {
      inFlightReviews.delete(cacheKey);
    }
  })();

  inFlightReviews.set(cacheKey, promise);
  return promise;
}

// Get Owner Reviews التقيمات علي المالك ده او منزله
export async function getOwnerReviewsService(ownerId, query = {}, t) {
  const features = new ReviewApiFeatures(query, {
    ownerId,
    status: "APPROVED",
  })
    .filter()
    .sort()
    .paginate();

  const page = Math.floor(features.skip / features.take) + 1;
  const limit = features.take;
  const cacheKey = `reviews:owner:${ownerId}:${page}:${limit}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  if (inFlightReviews.has(cacheKey)) {
    return inFlightReviews.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const execResult = await features.execute(prisma.review, {
        include: {
          tenant: {
            select: { firstName: true, lastName: true, avatar: true },
          },
          property: { select: { title: true } },
        },
      });

      const result = {
        data: execResult.data,
        meta: execResult.meta,
      };

      setMemoryCache(cacheKey, result, 60);
      return result;
    } finally {
      inFlightReviews.delete(cacheKey);
    }
  })();

  inFlightReviews.set(cacheKey, promise);
  return promise;
}

// Get My Reviews
export async function getMyReviewsService(tenantId, t) {
  return prisma.review.findMany({
    where: { tenantId },
    include: {
      property: { select: { title: true, city: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// Admin: Get Pending Reviews ف الاول احنا قافلين حته التقيم لحد اخر التجربه
export async function getPendingReviewsService(t) {
  return prisma.review.findMany({
    where: { status: "PENDING" },
    include: {
      tenant: { select: { firstName: true, lastName: true } },
      property: { select: { title: true } },
    },
    orderBy: { createdAt: "asc" },
  });
}

// Admin Review Moderate (
export async function moderateReviewService(reviewId, adminId, status, t) {
  if (!["APPROVED", "REJECTED", "PENDING"].includes(status)) {
    throw new AppError(t("review.invalidModerationStatus"), 400);
  }

  const review = await prisma.review.findUnique({ where: { id: reviewId } });

  if (!review) {
    throw new AppError(t("review.notFound"), 404);
  }

  const updated = await prisma.review.update({
    where: { id: reviewId },
    data: {
      status,
      moderatedById: adminId,
    },
  });

  clearReviewsCache();

  return updated;
}

export async function getAllReviewsService(query, t) {
  const features = new ReviewApiFeatures(query).filter().sort().paginate();

  const result = await features.execute(prisma.review, {
    include: {
      tenant: { select: { firstName: true, lastName: true } },
      property: { select: { title: true } },
    },
  });

  return {
    data: result.data,
    meta: result.meta,
  };
}
