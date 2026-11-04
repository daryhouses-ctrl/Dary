import { prisma } from "../config/prisma/PrismaService.js";
import { AppError } from "../core/middleware/error/AppError.js";
import {
  cloudinaryUploadImage,
  cloudinaryRemoveMultiple,
} from "../core/cloudinary/Cloudinary.js";
import { dispatchNotificationService } from "./notificationServices.js";
import { PropertyApiFeatures } from "../utils/api-features.js";
import { generateCacheKey } from "../utils/cache.js";
import {
  getMemoryCache,
  setMemoryCache,
  deleteMemoryCache,
} from "../utils/memoryCache.js";
import { clearPropertyCache } from "../utils/propertyCache.js";

async function safelyDispatchNotification(data, context = "") {
  try {
    await dispatchNotificationService(data);
  } catch (error) {
    console.error(`[Notification Error] ${context}`, error);
  }
}

async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  const executing = new Set();

  for (let i = 0; i < items.length; i++) {
    const p = Promise.resolve()
      .then(() => fn(items[i], i))
      .then((value) => {
        results[i] = { status: "fulfilled", value };
      })
      .catch((reason) => {
        results[i] = { status: "rejected", reason };
      })
      .finally(() => {
        executing.delete(p);
      });

    executing.add(p);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

let cachedAdminIds = null;
let adminIdsExpiry = 0;
async function getActiveAdminIds() {
  const now = Date.now();
  if (cachedAdminIds && now < adminIdsExpiry) {
    return cachedAdminIds;
  }
  const admins = await prisma.user.findMany({
    where: {
      userRoles: {
        some: {
          role: {
            name: { in: ["admin", "super_admin"] },
          },
        },
      },
      status: "ACTIVE",
      deletedAt: null,
    },
    select: { id: true },
  });
  cachedAdminIds = admins.map((a) => a.id);
  adminIdsExpiry = now + 5 * 60 * 1000; // 5 minutes TTL
  return cachedAdminIds;
}

const pendingViews = new Map();
function recordPropertyView(propertyId) {
  pendingViews.set(propertyId, (pendingViews.get(propertyId) || 0) + 1);
}

const viewFlushTimer = setInterval(async () => {
  if (!pendingViews.size) return;
  const batch = [...pendingViews.entries()];
  pendingViews.clear();

  await Promise.allSettled(
    batch.map(([id, count]) =>
      prisma.property
        .update({
          where: { id },
          data: { viewsCount: { increment: count } },
        })
        .catch(() => {}),
    ),
  );
}, 30_000);

if (viewFlushTimer.unref) {
  viewFlushTimer.unref();
}

// حساب خطوط الطول والعرض تلقائياً في الباك إند لو مبعتهمش الفرونت
async function autoGeocodeAddress({ address, district, nearestUniversity, city, governorate }) {
  const queries = [
    [address, district, city, governorate, "Egypt"].filter(Boolean).join(", "),
    [nearestUniversity, city, governorate, "Egypt"].filter(Boolean).join(", "),
    [district, city, governorate, "Egypt"].filter(Boolean).join(", "),
    [city, governorate, "Egypt"].filter(Boolean).join(", "),
  ].filter((q) => q && q !== "Egypt");
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=eg&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "DaryStudentHousing/1.0",
          "Accept-Language": "ar,en",
        },
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const lat = Number(parseFloat(data[0].lat).toFixed(6));
        const lng = Number(parseFloat(data[0].lon).toFixed(6));
        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
          return { latitude: lat, longitude: lng };
        }
      }
    } catch {
      // ignore and try next fallback query
    }
  }
  return { latitude: null, longitude: null };
}

// Create Property + Notification
export async function createPropertyService(ownerId, body, files, t) {
  const {
    title,
    description,
    governorate,
    city,
    district,
    address,
    latitude,
    longitude,
    nearestUniversity,
    distanceToUniversity,
    propertyType,
    propertyClass,
    targetTenantType,
    genderAllowed,
    isFurnished,
    electricityIncluded,
    waterIncluded,
    internetIncluded,
    amenities,
    roomsConfig,
  } = body;

  if (!title || !propertyType || !genderAllowed) {
    throw new AppError(t("property.missingFields"), 400);
  }

  if (
    (latitude != null && longitude == null) ||
    (longitude != null && latitude == null)
  ) {
    throw new AppError(t("property.locationBothRequired"), 400);
  }

  let parsedRoomsConfig = roomsConfig;
  if (typeof parsedRoomsConfig === "string") {
    try {
      parsedRoomsConfig = JSON.parse(parsedRoomsConfig);
    } catch {
      throw new AppError(t("property.roomsConfigRequired"), 400);
    }
  }

  if (!Array.isArray(parsedRoomsConfig) || parsedRoomsConfig.length === 0) {
    throw new AppError(t("property.roomsConfigRequired"), 400);
  }

  for (const room of parsedRoomsConfig) {
    const price = Number(room.pricePerBed);
    const total = Number(room.totalBeds);
    const available = Number(room.availableBeds);

    if (Number.isNaN(price) || price <= 0) {
      throw new AppError(t("property.invalidPricePerBed"), 400);
    }
    if (Number.isNaN(total) || total < 1 || !Number.isInteger(total)) {
      throw new AppError(t("property.invalidTotalBeds"), 400);
    }
    if (
      Number.isNaN(available) ||
      available < 0 ||
      available > total ||
      !Number.isInteger(available)
    ) {
      throw new AppError(t("property.invalidBedsCount"), 400);
    }
  }
  const computedStartingPrice = Math.min(
    ...parsedRoomsConfig.map((r) => Number(r.pricePerBed)),
  );

  const roomPhotos = files?.roomPhotos || [];
  const kitchenPhotos = files?.kitchenPhotos || [];
  const bathroomPhotos = files?.bathroomPhotos || [];
  const livingRoomPhotos = files?.livingRoomPhotos || [];

  if (roomPhotos.length !== parsedRoomsConfig.length) {
    throw new AppError(t("property.roomPhotosMismatch"), 400);
  }

  const jobs = [
    ...roomPhotos.map((f, i) => ({ group: "room", f, index: i })),
    ...kitchenPhotos.map((f, i) => ({ group: "kitchen", f, index: i })),
    ...bathroomPhotos.map((f, i) => ({ group: "bathroom", f, index: i })),
    ...livingRoomPhotos.map((f, i) => ({ group: "living", f, index: i })),
  ];

  const settled = await mapConcurrent(jobs, 4, (job) =>
    cloudinaryUploadImage(job.f.buffer),
  );

  const successfulUploads = settled
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value);

  if (successfulUploads.length !== jobs.length) {
    if (successfulUploads.length > 0) {
      await cloudinaryRemoveMultiple(
        successfulUploads.map((img) => img.public_id),
      ).catch(() => {});
    }
    throw new AppError(t("property.imageUploadFailed"), 500);
  }

  const uploadedRoomPhotos = [];
  const uploadedKitchen = [];
  const uploadedBathroom = [];
  const uploadedLivingRoom = [];

  jobs.forEach((job, i) => {
    const uploaded = settled[i].value;
    if (job.group === "room") uploadedRoomPhotos[job.index] = uploaded;
    else if (job.group === "kitchen") uploadedKitchen[job.index] = uploaded;
    else if (job.group === "bathroom") uploadedBathroom[job.index] = uploaded;
    else if (job.group === "living") uploadedLivingRoom[job.index] = uploaded;
  });

  const allUploadedPublicIds = successfulUploads.map((img) => img.public_id);

  let parsedLat =
    latitude !== undefined && latitude !== null && latitude !== ""
      ? Number(latitude)
      : null;
  let parsedLng =
    longitude !== undefined && longitude !== null && longitude !== ""
      ? Number(longitude)
      : null;
  if (Number.isNaN(parsedLat)) parsedLat = null;
  if (Number.isNaN(parsedLng)) parsedLng = null;
  // لو الإحداثيات مش مبعوتة، الباك إند يحسبها تلقائياً من العنوان/المدينة/الجامعة
  if (parsedLat === null || parsedLng === null) {
    const geocoded = await autoGeocodeAddress({
      address,
      district,
      nearestUniversity,
      city,
      governorate,
    });
    parsedLat = geocoded.latitude;
    parsedLng = geocoded.longitude;
  }

  let property;
  try {
    const roomsData = parsedRoomsConfig.map((room, index) => ({
      roomType: room.roomType,
      pricePerBed: Number(room.pricePerBed),
      totalBeds: Number(room.totalBeds),
      availableBeds: Number(room.availableBeds),
      status: room.status || "AVAILABLE",
      photoUrl: uploadedRoomPhotos[index].secure_url,
      photoPublicId: uploadedRoomPhotos[index].public_id,
    }));

    const imagesData = [
      ...uploadedKitchen.map((img, i) => ({
        url: img.secure_url,
        publicId: img.public_id,
        category: "kitchen",
        order: i,
      })),
      ...uploadedBathroom.map((img, i) => ({
        url: img.secure_url,
        publicId: img.public_id,
        category: "bathroom",
        order: i,
      })),
      ...uploadedLivingRoom.map((img, i) => ({
        url: img.secure_url,
        publicId: img.public_id,
        category: "living_room",
        order: i,
      })),
    ];

    property = await prisma.property.create({
      data: {
        ownerId,
        title,
        description,
        governorate,
        city,
        district,
        address,
        latitude: parsedLat,
        longitude: parsedLng,
        nearestUniversity,
        distanceToUniversity,
        propertyType,
        propertyClass,
        targetTenantType,
        genderAllowed,
        rooms: parsedRoomsConfig.length,
        startingPrice: computedStartingPrice,
        isFurnished,
        electricityIncluded,
        waterIncluded,
        internetIncluded,
        amenities: amenities || [],
        status: "PENDING",
        rooms_: {
          create: roomsData,
        },
        images: {
          create: imagesData,
        },
      },
      include: {
        rooms_: true,
        images: true,
      },
    });
  } catch (dbError) {
    await cloudinaryRemoveMultiple(allUploadedPublicIds).catch(() => {});
    throw dbError;
  }

  clearPropertyCache();

  void (async () => {
    try {
      const adminIds = await getActiveAdminIds();
      for (const adminId of adminIds) {
        void safelyDispatchNotification(
          {
            userId: adminId,
            event: "property",
            channel: "in_app",
            title: "New Property Awaiting Approval",
            body: `A new property listing, "${property.title}", has been submitted and requires your approval before it can be published.`,
            payload: {
              action: "submitted",
              propertyId: property.id,
              ownerId: property.ownerId,
              title: property.title,
              propertyType: property.propertyType,
              propertyClass: property.propertyClass,
              city: property.city,
              district: property.district,
              status: property.status,
              rooms: property.rooms,
              startingPrice: property.startingPrice,
            },
            relatedEntityType: "property",
            relatedEntityId: property.id,
          },
          `property ${property.id} → admin ${adminId}`,
        );
      }

      void safelyDispatchNotification(
        {
          userId: ownerId,
          event: "property",
          channel: "in_app",
          title: "Property Submitted Successfully",
          body: `Your property "${property.title}" has been submitted successfully and is waiting for admin approval.`,
          payload: {
            action: "submitted",
            propertyId: property.id,
            ownerId: property.ownerId,
            title: property.title,
            propertyType: property.propertyType,
            propertyClass: property.propertyClass,
            city: property.city,
            district: property.district,
            status: property.status,
            rooms: property.rooms,
            startingPrice: property.startingPrice,
          },
          relatedEntityType: "property",
          relatedEntityId: property.id,
        },
        `property ${property.id} → owner ${ownerId}`,
      );
    } catch (notifErr) {
      console.error(
        "Failed to send property submission notification:",
        notifErr,
      );
    }
  })();

  return property;
}

function normalizePropertiesQuery(rawQuery = {}) {
  const normalized = {};

  const limit = Math.min(Math.max(Number(rawQuery.limit) || 10, 1), 100);
  normalized.limit = limit;

  if (rawQuery.cursor) {
    normalized.cursor = String(rawQuery.cursor).trim();
  } else {
    const page = Math.max(Number(rawQuery.page) || 1, 1);
    normalized.page = page;
  }

  const allowedSortFields = [
    "createdAt",
    "updatedAt",
    "startingPrice",
    "viewsCount",
    "title",
  ];
  if (rawQuery.sort && allowedSortFields.includes(rawQuery.sort)) {
    normalized.sort = rawQuery.sort;
    normalized.order = rawQuery.order?.toLowerCase() === "asc" ? "asc" : "desc";
  }

  const filterKeys = [
    "search",
    "city",
    "propertyType",
    "propertyClass",
    "genderAllowed",
    "roomType",
    "rooms",
    "minPrice",
    "maxPrice",
    "availableOnly",
    "targetTenantType",
    "isFurnished",
    "status",
  ];

  for (const key of filterKeys) {
    if (rawQuery[key] !== undefined && rawQuery[key] !== null) {
      const val = String(rawQuery[key]).trim();
      if (val !== "") {
        normalized[key] = val;
      }
    }
  }

  return normalized;
}

const inFlightProperties = new Map();

// Get Public Properties
export async function getPropertiesService(query, t) {
  const totalStart = performance.now();

  const normalizedQuery = normalizePropertiesQuery(query);
  const cacheKey = generateCacheKey("properties:public", normalizedQuery);

  const cacheStart = performance.now();
  const cachedData = getMemoryCache(cacheKey);
  const cacheTime = performance.now() - cacheStart;

  if (cachedData !== null) {
    const totalTime = performance.now() - totalStart;
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[PROPERTY CACHE] HIT | cache=${cacheTime.toFixed(
          2,
        )}ms | total=${totalTime.toFixed(2)}ms`,
      );
    }
    return cachedData;
  }

  if (inFlightProperties.has(cacheKey)) {
    const data = await inFlightProperties.get(cacheKey);
    const totalTime = performance.now() - totalStart;
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[PROPERTY CACHE] IN-FLIGHT DEDUP HIT | total=${totalTime.toFixed(2)}ms`,
      );
    }
    return data;
  }

  // 3. Create the fetch promise for concurrent requests to share
  const fetchPromise = (async () => {
    const dbStart = performance.now();

    const features = new PropertyApiFeatures(normalizedQuery)
      .filter()
      .sort()
      .paginate();

    features.where.deletedAt = null;
    features.where.status = "APPROVED";
    features.where.isAvailable = true;

    const result = await features.execute(prisma.property);

    const dbTime = performance.now() - dbStart;

    const response = {
      data: result.data,
      meta: result.meta,
    };

    setMemoryCache(cacheKey, response, 60);

    const totalTime = performance.now() - totalStart;
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[PROPERTY CACHE] MISS (FETCHED & CACHED) | db=${dbTime.toFixed(
          2,
        )}ms | total=${totalTime.toFixed(2)}ms`,
      );
    }

    return response;
  })();

  inFlightProperties.set(cacheKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    inFlightProperties.delete(cacheKey);
  }
}

// Get Dynamic Property Filter Facets
export async function getPropertyFacetsService() {
  const cacheKey = "properties:public:facets";
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const where = {
    deletedAt: null,
    status: "APPROVED",
    isAvailable: true,
  };

  const [
    governorates,
    cities,
    districts,
    universities,
    propertyTypes,
    propertyClasses,
    genderAllowed,
    roomTypes,
    amenitiesList,
  ] = await Promise.all([
    prisma.property.findMany({
      where: { ...where, governorate: { not: null } },
      select: { governorate: true },
      distinct: ["governorate"],
    }),
    prisma.property.findMany({
      where: { ...where, city: { not: null } },
      select: { city: true },
      distinct: ["city"],
    }),
    prisma.property.findMany({
      where: { ...where, district: { not: null } },
      select: { district: true },
      distinct: ["district"],
    }),
    prisma.property.findMany({
      where: { ...where, nearestUniversity: { not: null } },
      select: { nearestUniversity: true },
      distinct: ["nearestUniversity"],
    }),
    prisma.property.findMany({
      where,
      select: { propertyType: true },
      distinct: ["propertyType"],
    }),
    prisma.property.findMany({
      where,
      select: { propertyClass: true },
      distinct: ["propertyClass"],
    }),
    prisma.property.findMany({
      where,
      select: { genderAllowed: true },
      distinct: ["genderAllowed"],
    }),
    prisma.propertyRoom.findMany({
      where: {
        property: where,
      },
      select: { roomType: true },
      distinct: ["roomType"],
    }),
    prisma.property.findMany({
      where,
      select: { amenities: true },
    }),
  ]);

  const amenitiesSet = new Set();
  for (const item of amenitiesList) {
    if (Array.isArray(item.amenities)) {
      for (const a of item.amenities) {
        if (a && typeof a === "string" && a.trim()) {
          amenitiesSet.add(a.trim());
        }
      }
    }
  }

  const facets = {
    governorates: governorates
      .map((g) => g.governorate?.trim())
      .filter((g) => Boolean(g)),
    cities: cities
      .map((c) => c.city?.trim())
      .filter((c) => Boolean(c)),
    districts: districts
      .map((d) => d.district?.trim())
      .filter((d) => Boolean(d)),
    universities: universities
      .map((u) => u.nearestUniversity?.trim())
      .filter((u) => Boolean(u)),
    propertyTypes: propertyTypes
      .map((p) => p.propertyType)
      .filter(Boolean),
    propertyClasses: propertyClasses
      .map((p) => p.propertyClass)
      .filter(Boolean),
    genderAllowed: genderAllowed
      .map((g) => g.genderAllowed)
      .filter(Boolean),
    roomTypes: roomTypes
      .map((r) => r.roomType)
      .filter(Boolean),
    amenities: Array.from(amenitiesSet),
  };

  setMemoryCache(cacheKey, facets, 300);
  return facets;
}

const inFlightMyProperties = new Map();

// Get Single Property
export async function getPropertyByIdService(id, viewer = null, t) {
  const cacheKey = `properties:id:${id}`;
  const cached = getMemoryCache(cacheKey);

  if (cached !== null) {
    recordPropertyView(id);
    return cached;
  }

  const property = await prisma.property.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    include: {
      images: {
        orderBy: { order: "asc" },
      },
      rooms_: {
        select: {
          id: true,
          propertyId: true,
          roomType: true,
          pricePerBed: true,
          totalBeds: true,
          availableBeds: true,
          status: true,
          photoUrl: true,
          photoPublicId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatar: true,
          whatsappPhone: true,
        },
      },
    },
  });

  if (!property) {
    throw new AppError(t("property.notFound"), 404);
  }

  const isOwner = viewer?.id && viewer.id === property.ownerId;
  const isAdmin = Boolean(viewer?.isAdmin);

  if (property.status !== "APPROVED" && !isOwner && !isAdmin) {
    throw new AppError(t("property.notFound"), 404);
  }

  // Increment view count in memory buffer
  recordPropertyView(id);

  // Only cache approved properties publicly
  if (property.status === "APPROVED") {
    setMemoryCache(cacheKey, property, 60);
  }

  return property;
}

// Get My Properties (Owner)
export async function getMyPropertiesService(ownerId, t) {
  const cacheKey = `properties:my:${ownerId}`;
  const cached = getMemoryCache(cacheKey);
  if (cached !== null) return cached;

  if (inFlightMyProperties.has(cacheKey)) {
    return inFlightMyProperties.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const properties = await prisma.property.findMany({
        where: {
          ownerId,
          deletedAt: null,
        },
        include: {
          images: {
            where: { isPrimary: true },
            take: 1,
          },
          rooms_: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      setMemoryCache(cacheKey, properties, 60);
      return properties;
    } finally {
      inFlightMyProperties.delete(cacheKey);
    }
  })();

  inFlightMyProperties.set(cacheKey, promise);
  return promise;
}

const EDITABLE_FIELDS = [
  "title",
  "description",
  "address",
  "city",
  "district",
  "governorate",
  "latitude",
  "longitude",
  "nearestUniversity",
  "distanceToUniversity",
  "isFurnished",
  "electricityIncluded",
  "waterIncluded",
  "internetIncluded",
  "amenities",
];

const SENSITIVE_FIELDS = new Set([
  "title",
  "address",
  "city",
  "district",
  "governorate",
  "latitude",
  "longitude",
  "nearestUniversity",
  "distanceToUniversity",
]);

// Update Property
export async function updatePropertyService(
  id,
  ownerId,
  data,
  t,
  isAdmin = false,
) {
  const property = await prisma.property.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });

  if (!property) {
    throw new AppError(t("property.notFound"), 404);
  }

  if (!isAdmin && property.ownerId !== ownerId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (!isAdmin && property.status === "SUSPENDED") {
    throw new AppError(t("property.cannotEditSuspended"), 400);
  }

  const safeData = {};
  let hasSensitiveChange = false;

  for (const key of EDITABLE_FIELDS) {
    if (key in data && data[key] !== undefined) {
      safeData[key] = data[key];
      if (SENSITIVE_FIELDS.has(key) && data[key] !== property[key]) {
        hasSensitiveChange = true;
      }
    }
  }

  if (safeData.latitude !== undefined && safeData.latitude !== null) {
    safeData.latitude = Number(safeData.latitude);
  }
  if (safeData.longitude !== undefined && safeData.longitude !== null) {
    safeData.longitude = Number(safeData.longitude);
  }
  // لو العقار معندوش إحداثيات أو العنوان اتعدل من غير إحداثيات جديدة، احسبها تلقائياً
  const addressChanged =
    safeData.address !== undefined ||
    safeData.district !== undefined ||
    safeData.city !== undefined ||
    safeData.governorate !== undefined ||
    safeData.nearestUniversity !== undefined;
  if (
    (safeData.latitude == null || safeData.longitude == null) &&
    (property.latitude == null || property.longitude == null || addressChanged)
  ) {
    const geocoded = await autoGeocodeAddress({
      address: safeData.address ?? property.address,
      district: safeData.district ?? property.district,
      nearestUniversity: safeData.nearestUniversity ?? property.nearestUniversity,
      city: safeData.city ?? property.city,
      governorate: safeData.governorate ?? property.governorate,
    });
    if (geocoded.latitude !== null && geocoded.longitude !== null) {
      safeData.latitude = geocoded.latitude;
      safeData.longitude = geocoded.longitude;
    }
  }

  let newStatus = property.status;
  let rejectionReason = property.rejectionReason;

  if (
    !isAdmin &&
    (property.status === "REJECTED" ||
      (property.status === "APPROVED" && hasSensitiveChange))
  ) {
    newStatus = "PENDING";
    rejectionReason = null;
  }

  const updated = await prisma.property.update({
    where: { id },
    data: {
      ...safeData,
      status: newStatus,
      rejectionReason,
    },
  });

  clearPropertyCache();
  deleteMemoryCache(`properties:id:${id}`);
  deleteMemoryCache(`properties:my:${property.ownerId}`);

  return updated;
}
// Soft delete property
export async function deletePropertyService(id, userId, t, isAdmin = false) {
  const existing = await prisma.property.findUnique({
    where: { id },
    select: { id: true, ownerId: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(t("property.notFound"), 404);
  }

  if (!isAdmin && existing.ownerId !== userId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  if (!isAdmin) {
    const now = new Date();
    const activeBookingsCount = await prisma.booking.count({
      where: {
        propertyId: id,
        status: { in: ["PENDING", "CONTACTED", "CLOSED"] },
        OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
    });

    if (activeBookingsCount > 0) {
      throw new AppError(t("property.hasActiveBookings"), 400);
    }
  }

  await prisma.property.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isAvailable: false,
    },
  });

  try {
    clearPropertyCache();
    deleteMemoryCache(`properties:id:${id}`);
    deleteMemoryCache(`properties:my:${existing.ownerId}`);
  } catch (cacheError) {
    console.error("Failed to clear property cache:", cacheError);
  }
}
// Availability
export async function toggleAvailabilityService(
  id,
  userId,
  explicitAvailability,
  t,
  isAdmin = false,
) {
  const property = await prisma.property.findFirst({
    where: {
      id,
      deletedAt: null,
    },
    select: {
      id: true,
      ownerId: true,
      isAvailable: true,
    },
  });

  if (!property) {
    throw new AppError(t("property.notFound"), 404);
  }

  if (!isAdmin && property.ownerId !== userId) {
    throw new AppError(t("common.forbidden"), 403);
  }

  const targetAvailability =
    explicitAvailability !== undefined
      ? Boolean(explicitAvailability)
      : !property.isAvailable;

  const updated = await prisma.property.update({
    where: { id },
    data: {
      isAvailable: targetAvailability,
    },
  });

  clearPropertyCache();
  deleteMemoryCache(`properties:id:${id}`);
  deleteMemoryCache(`properties:my:${property.ownerId}`);

  return updated;
}
export async function getPendingPropertiesService(t) {
  return prisma.property.findMany({
    where: {
      status: "PENDING",
      deletedAt: null,
    },
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      rooms_: true,
      images: {
        where: { isPrimary: true },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}
// Review Property (APPROVED / REJECTED)
export async function reviewPropertyService(
  id,
  adminId,
  { status, rejectionReason },
  t,
) {
  if (!["APPROVED", "REJECTED"].includes(status)) {
    throw new AppError(t("property.invalidReviewStatus"), 400);
  }

  if (status === "REJECTED" && !rejectionReason) {
    throw new AppError(t("property.rejectionReasonRequired"), 400);
  }

  const existing = await prisma.property.findUnique({
    where: { id },
    select: { id: true, status: true, deletedAt: true },
  });

  if (!existing || existing.deletedAt) {
    throw new AppError(t("property.notFound"), 404);
  }

  const updateData = {
    status,
    isVerified: status === "APPROVED",
    rejectionReason: status === "REJECTED" ? rejectionReason : null,
    reviewedById: adminId,
    reviewedAt: new Date(),
  };

  if (status === "APPROVED" && existing.status === "SUSPENDED") {
    updateData.isAvailable = true;
  }

  const updatedProperty = await prisma.property.update({
    where: { id },
    data: updateData,
  });

  clearPropertyCache();
  deleteMemoryCache(`properties:id:${id}`);
  deleteMemoryCache(`properties:my:${updatedProperty.ownerId}`);

  const isApproved = status === "APPROVED";
  const notificationTitle = isApproved
    ? "Property Approved"
    : "Property Rejected";

  const notificationBody = isApproved
    ? `Your property "${updatedProperty.title}" has been approved and is now available.`
    : `Your property "${updatedProperty.title}" has been rejected. Reason: ${updatedProperty.rejectionReason}`;

  void safelyDispatchNotification(
    {
      userId: updatedProperty.ownerId,
      event: "property",
      channel: "in_app",
      title: notificationTitle,
      body: notificationBody,
      payload: {
        action: isApproved ? "approved" : "rejected",
        propertyId: updatedProperty.id,
        ownerId: updatedProperty.ownerId,
        title: updatedProperty.title,
        status: updatedProperty.status,
        isVerified: updatedProperty.isVerified,
        rejectionReason: updatedProperty.rejectionReason,
        reviewedById: updatedProperty.reviewedById,
        reviewedAt: updatedProperty.reviewedAt,
      },
      relatedEntityType: "property",
      relatedEntityId: updatedProperty.id,
    },
    `property ${id} review → owner ${updatedProperty.ownerId}`,
  );

  return updatedProperty;
}
// Suspend Property
export async function suspendPropertyService(id, adminId, t) {
  const { count } = await prisma.property.updateMany({
    where: {
      id,
      status: { not: "SUSPENDED" },
      deletedAt: null,
    },
    data: {
      status: "SUSPENDED",
      isAvailable: false,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
  });

  if (count === 0) {
    const existing = await prisma.property.findUnique({
      where: { id },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!existing || existing.deletedAt) {
      throw new AppError(t("property.notFound"), 404);
    }
    throw new AppError(t("property.alreadySuspended"), 409);
  }

  const updatedProperty = await prisma.property.findUnique({
    where: { id },
  });

  clearPropertyCache();
  deleteMemoryCache(`properties:id:${id}`);
  deleteMemoryCache(`properties:my:${updatedProperty.ownerId}`);

  void safelyDispatchNotification(
    {
      userId: updatedProperty.ownerId,
      event: "property",
      channel: "in_app",
      title: "Property Suspended",
      body: `Your property "${updatedProperty.title}" has been suspended by the administration.`,
      payload: {
        action: "suspended",
        propertyId: updatedProperty.id,
        ownerId: updatedProperty.ownerId,
        title: updatedProperty.title,
        status: updatedProperty.status,
        reviewedById: updatedProperty.reviewedById,
        reviewedAt: updatedProperty.reviewedAt,
      },
      relatedEntityType: "property",
      relatedEntityId: updatedProperty.id,
    },
    `property ${id} suspension → owner ${updatedProperty.ownerId}`,
  );

  return updatedProperty;
}
