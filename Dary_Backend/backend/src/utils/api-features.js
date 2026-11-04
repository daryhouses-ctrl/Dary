import { prisma } from "../config/prisma/PrismaService.js";

/**
 * Base reusable query builder for Prisma models.
 * Handles filtering, sorting, pagination (offset & cursor), and query execution.
 */
class BaseApiFeatures {
  constructor(queryString = {}, options = {}) {
    this.queryString = queryString || {};

    this.where = options.defaultWhere ? { ...options.defaultWhere } : {};

    this.orderBy = options.defaultOrderBy
      ? Array.isArray(options.defaultOrderBy)
        ? [...options.defaultOrderBy]
        : { ...options.defaultOrderBy }
      : {
          createdAt: "desc",
        };

    this.allowedSortFields = options.allowedSortFields || [
      "createdAt",
      "updatedAt",
    ];

    this.defaultLimit = options.defaultLimit || 10;

    this.skip = 0;
    this.take = this.defaultLimit;
    this.cursor = undefined;
    this.isCursor = false;
  }

  filter() {
    return this;
  }

  sort() {
    const { sort, order } = this.queryString;

    if (sort && this.allowedSortFields.includes(sort)) {
      this.orderBy = {
        [sort]: order?.toLowerCase() === "desc" ? "desc" : "asc",
      };
    }

    return this;
  }

  paginate() {
    const limit = Math.min(
      Math.max(Number(this.queryString.limit) || this.defaultLimit, 1),
      100,
    );

    this.take = limit;

    if (this.queryString.cursor) {
      this.cursor = {
        id: this.queryString.cursor,
      };
      this.skip = 1;
      this.isCursor = true;
    } else {
      const page = Math.max(Number(this.queryString.page) || 1, 1);
      this.skip = (page - 1) * limit;
      this.isCursor = false;
    }

    return this;
  }

  async execute(model, options = {}) {
    const { include, select } = options;

    let data;
    let totalCount;
    let currentPage;
    let totalPages;
    let hasNextPage;
    let hasPrevPage;
    let nextCursor = null;

    if (this.isCursor) {
      const items = await model.findMany({
        where: this.where,
        orderBy: this.orderBy,
        cursor: this.cursor,
        skip: this.skip,
        take: this.take + 1,
        ...(include && { include }),
        ...(select && { select }),
      });

      hasNextPage = items.length > this.take;
      data = hasNextPage ? items.slice(0, this.take) : items;
      hasPrevPage = true;
      nextCursor =
        hasNextPage && data.length > 0 ? data[data.length - 1].id : null;
      currentPage = null;
      totalPages = null;
      totalCount = null;
    } else {
      const [items, count] = await Promise.all([
        model.findMany({
          where: this.where,
          orderBy: this.orderBy,
          skip: this.skip,
          take: this.take,
          ...(include && { include }),
          ...(select && { select }),
        }),

        model.count({
          where: this.where,
        }),
      ]);

      data = items;
      totalCount = count;
      currentPage = Math.floor(this.skip / this.take) + 1;
      totalPages = Math.ceil(totalCount / this.take);
      hasNextPage = currentPage < totalPages;
      hasPrevPage = currentPage > 1;
      nextCursor = data.length > 0 ? data[data.length - 1].id : null;
    }

    return {
      data,
      currentPage,
      totalPages,
      totalCount,
      hasNextPage,
      hasPrevPage,
      nextCursor,
      meta: {
        total: totalCount,
        page: currentPage,
        limit: this.take,
        totalPages,
        hasNextPage,
        hasPrevPage,
        hasPreviousPage: hasPrevPage,
        nextCursor,
      },
    };
  }
}

/**
 * Property-specific ApiFeatures (Public & Admin Dashboard properties).
 */
class PropertyApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}) {
    super(queryString, {
      defaultWhere: {
        deletedAt: null,
      },
      defaultOrderBy: {
        createdAt: "desc",
      },
      allowedSortFields: [
        "createdAt",
        "updatedAt",
        "startingPrice",
        "viewsCount",
        "title",
      ],
      defaultLimit: 10,
    });
  }

  filter() {
    const {
      search,
      city,
      propertyType,
      propertyClass,
      genderAllowed,
      roomType,
      rooms,
      minPrice,
      maxPrice,
      availableOnly,
      targetTenantType,
      isFurnished,
      status,
    } = this.queryString;

    if (search) {
      this.where.OR = [
        {
          title: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          governorate: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          city: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          district: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          address: {
            contains: search,
            mode: "insensitive",
          },
        },
      ];
    }

    if (city) {
      this.where.city = {
        equals: city,
        mode: "insensitive",
      };
    }

    if (propertyType) {
      const values = propertyType
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.where.propertyType =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    }

    if (propertyClass) {
      const values = propertyClass
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.where.propertyClass =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    }

    if (genderAllowed) {
      const values = genderAllowed
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.where.genderAllowed =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    }

    if (roomType) {
      const values = roomType
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.where.rooms_ = {
        some: {
          roomType:
            values.length === 1
              ? values[0]
              : {
                  in: values,
                },
        },
      };
    }

    if (minPrice || maxPrice) {
      this.where.startingPrice = {};

      if (minPrice) {
        this.where.startingPrice.gte = Number(minPrice);
      }

      if (maxPrice) {
        this.where.startingPrice.lte = Number(maxPrice);
      }
    }

    if (availableOnly === "true" || this.queryString.isAvailable === "true") {
      this.where.isAvailable = true;
    } else if (
      availableOnly === "false" ||
      this.queryString.isAvailable === "false"
    ) {
      this.where.isAvailable = false;
    }

    if (isFurnished === "true") {
      this.where.isFurnished = true;
    }

    if (targetTenantType) {
      this.where.targetTenantType = targetTenantType;
    }

    if (status) {
      const validPropertyStatuses = new Set([
        "PENDING",
        "APPROVED",
        "REJECTED",
        "SUSPENDED",
        "ARCHIVED",
      ]);

      const rawValues = String(status)
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      const enumValues = [];

      for (const val of rawValues) {
        if (validPropertyStatuses.has(val)) {
          enumValues.push(val);
        } else if (val === "AVAILABLE") {
          this.where.status = "APPROVED";
          this.where.isAvailable = true;
          this.where.rooms_ = {
            ...this.where.rooms_,
            some: {
              ...(this.where.rooms_?.some || {}),
              status: "AVAILABLE",
              availableBeds: { gt: 0 },
            },
          };
        } else if (
          val === "FULL" ||
          val === "BOOKED" ||
          val === "FULLY_BOOKED" ||
          val === "UNAVAILABLE"
        ) {
          this.where.OR = [
            ...(this.where.OR || []),
            { isAvailable: false },
            {
              rooms_: {
                every: {
                  OR: [{ status: "FULL" }, { availableBeds: 0 }],
                },
              },
            },
          ];
        }
      }

      if (enumValues.length === 1) {
        this.where.status = enumValues[0];
      } else if (enumValues.length > 1) {
        this.where.status = { in: enumValues };
      }
    }

    if (rooms) {
      const roomsCount = Number(rooms);

      if (Number.isInteger(roomsCount) && roomsCount > 0) {
        this.where.rooms =
          roomsCount >= 4
            ? {
                gte: 4,
              }
            : roomsCount;
      }
    }

    return this;
  }

  async execute(model = prisma.property, options = {}) {
    const roomTypeFilter = this.queryString.roomType
      ? this.queryString.roomType
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : null;

    const roomsInclude = roomTypeFilter
      ? {
          where: {
            roomType:
              roomTypeFilter.length === 1
                ? roomTypeFilter[0]
                : {
                    in: roomTypeFilter,
                  },
          },
          select: {
            id: true,
            roomType: true,
            pricePerBed: true,
            totalBeds: true,
            availableBeds: true,
            status: true,
            photoUrl: true,
          },
        }
      : {
          select: {
            id: true,
            roomType: true,
            pricePerBed: true,
            totalBeds: true,
            availableBeds: true,
            status: true,
            photoUrl: true,
          },
        };

    const defaultSelectFields = {
      id: true,
      title: true,
      description: true,
      governorate: true,
      city: true,
      district: true,
      address: true,
      latitude: true,
      longitude: true,
      nearestUniversity: true,
      distanceToUniversity: true,
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
      isAvailable: true,
      viewsCount: true,
      status: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
      rooms_: roomsInclude,
    };

    const result = await super.execute(model, {
      ...options,
      select:
        options.select || (!options.include ? defaultSelectFields : undefined),
    });

    const { data } = result;

    if (data.length > 0 && options.attachImages !== false) {
      const propertyIds = data.map((p) => p.id).filter(Boolean);
      if (propertyIds.length > 0) {
        const images = await prisma.propertyImage.findMany({
          where: { propertyId: { in: propertyIds } },
          orderBy: [
            { isPrimary: "desc" },
            { order: "asc" },
            { createdAt: "asc" },
          ],
          select: {
            propertyId: true,
            id: true,
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

        for (const item of data) {
          item.images = imageMap.get(item.id) || [];
        }
      }
    }

    return result;
  }
}

/**
 * Support Ticket ApiFeatures.
 */
class TicketApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}) {
    super(queryString, {
      defaultWhere: {},
      defaultOrderBy: {
        createdAt: "desc",
      },
      allowedSortFields: ["createdAt", "updatedAt", "status", "category"],
      defaultLimit: 20,
    });
  }

  filter() {
    const { status, category, search, assignedAdminId, userId } =
      this.queryString;

    if (status) {
      const values = String(status)
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      this.where.status =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    }

    if (category) {
      const values = String(category)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.where.category =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    }

    if (assignedAdminId) {
      this.where.assignedAdminId = assignedAdminId;
    }

    if (userId) {
      this.where.userId = userId;
    }

    if (search) {
      const trimmed = String(search).trim();
      if (trimmed) {
        this.where.OR = [
          {
            subject: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
          {
            category: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        ];
      }
    }

    return this;
  }
}

/**
 * Contract ApiFeatures.
 */
class ContractApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}) {
    super(queryString, {
      defaultWhere: {},
      defaultOrderBy: {
        createdAt: "desc",
      },
      allowedSortFields: ["createdAt", "updatedAt", "status", "contractNumber"],
      defaultLimit: 20,
    });
  }

  filter() {
    const { status, bookingId } = this.queryString;

    if (status) {
      this.where.status = status;
    }

    if (bookingId) {
      this.where.bookingId = bookingId;
    }

    return this;
  }
}

/**
 * Review ApiFeatures.
 */
class ReviewApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}, defaultWhere = {}) {
    super(queryString, {
      defaultWhere,
      defaultOrderBy: {
        createdAt: "desc",
      },
      allowedSortFields: [
        "createdAt",
        "updatedAt",
        "propertyRating",
        "ownerRating",
        "status",
      ],
      defaultLimit: 20,
    });
  }

  filter() {
    const { status, propertyId, ownerId, tenantId } = this.queryString;

    if (status && this.where.status === undefined) {
      this.where.status = status;
    }

    if (propertyId && this.where.propertyId === undefined) {
      this.where.propertyId = propertyId;
    }

    if (ownerId && this.where.ownerId === undefined) {
      this.where.ownerId = ownerId;
    }

    if (tenantId && this.where.tenantId === undefined) {
      this.where.tenantId = tenantId;
    }

    return this;
  }
}

/**
 * Report ApiFeatures.
 */
class ReportApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}) {
    super(queryString, {
      defaultWhere: {},
      defaultOrderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      allowedSortFields: ["createdAt", "priority", "status", "resolvedAt"],
      defaultLimit: 20,
    });
  }

  filter() {
    const { status, reportedType, priority, reporterId } = this.queryString;

    if (status) {
      this.where.status = status;
    }

    if (reportedType) {
      this.where.reportedType = reportedType;
    }

    if (priority) {
      this.where.priority = priority;
    }

    if (reporterId) {
      this.where.reporterId = reporterId;
    }

    return this;
  }
}

/**
 * Notification ApiFeatures.
 */
class NotificationApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}, defaultWhere = {}) {
    super(queryString, {
      defaultWhere,
      defaultOrderBy: {
        createdAt: "desc",
      },
      allowedSortFields: ["createdAt", "isRead"],
      defaultLimit: 20,
    });
  }

  filter() {
    const { isRead, event } = this.queryString;

    if (isRead !== undefined && isRead !== "") {
      this.where.isRead = isRead === "true" || isRead === true;
    }

    if (event) {
      this.where.event = event;
    }

    return this;
  }
}

/**
 * User (Dashboard) ApiFeatures.
 */
class UserApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}) {
    super(queryString, {
      defaultWhere: {
        deletedAt: null,
      },
      defaultOrderBy: {
        createdAt: "desc",
      },
      allowedSortFields: ["createdAt", "firstName", "email"],
      defaultLimit: 20,
    });
  }

  filter() {
    const { role, status, search } = this.queryString;

    if (role) {
      this.where.userRoles = {
        some: {
          role: {
            name: role,
          },
        },
      };
    }

    if (status) {
      this.where.status = status;
    }

    const trimmedSearch = search?.trim();

    if (trimmedSearch) {
      this.where.OR = [
        {
          firstName: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
        {
          lastName: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
        {
          phone: {
            contains: trimmedSearch,
            mode: "insensitive",
          },
        },
        {
          profile: {
            city: {
              contains: trimmedSearch,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    return this;
  }
}

/**
 * Booking & Calendar ApiFeatures.
 */
class BookingCalendarApiFeatures extends BaseApiFeatures {
  constructor(queryString = {}) {
    super(queryString, {
      defaultWhere: {
        property: {
          deletedAt: null,
        },
      },
      defaultOrderBy: {
        startDate: "asc",
      },
      allowedSortFields: [
        "startDate",
        "endDate",
        "createdAt",
        "updatedAt",
        "totalPrice",
        "status",
        "bedsRequested",
      ],
      defaultLimit: 10,
    });
  }

  filter() {
    const {
      startDate,
      endDate,
      status,
      propertyId,
      roomId,
      tenantId,
      assignedAdminId,
      search,
      minPrice,
      maxPrice,
      bedsRequested,
      month,
      year,
    } = this.queryString;

    if (startDate || endDate) {
      if (startDate && endDate) {
        const parsedStart = new Date(startDate);
        const parsedEnd = new Date(endDate);
        if (
          !Number.isNaN(parsedStart.getTime()) &&
          !Number.isNaN(parsedEnd.getTime())
        ) {
          this.where.startDate = { lt: parsedEnd };
          this.where.endDate = { gt: parsedStart };
        }
      } else if (startDate) {
        const parsedStart = new Date(startDate);
        if (!Number.isNaN(parsedStart.getTime())) {
          this.where.startDate = { gte: parsedStart };
        }
      } else if (endDate) {
        const parsedEnd = new Date(endDate);
        if (!Number.isNaN(parsedEnd.getTime())) {
          this.where.endDate = { lte: parsedEnd };
        }
      }
    } else if (month && year) {
      const parsedYear = Number(year);
      const parsedMonth = Number(month) - 1;
      if (!Number.isNaN(parsedYear) && !Number.isNaN(parsedMonth)) {
        const monthStart = new Date(parsedYear, parsedMonth, 1);
        const monthEnd = new Date(
          parsedYear,
          parsedMonth + 1,
          0,
          23,
          59,
          59,
          999,
        );
        this.where.startDate = { lt: monthEnd };
        this.where.endDate = { gt: monthStart };
      }
    }

    if (status) {
      const values = status
        .split(",")
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean);

      this.where.status =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    } else {
      this.where.status = {
        not: "CANCELLED",
      };
    }

    if (propertyId) {
      const values = propertyId
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.where.propertyId =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    }

    if (roomId) {
      const values = roomId
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      this.where.roomId =
        values.length === 1
          ? values[0]
          : {
              in: values,
            };
    }

    if (tenantId) {
      this.where.tenantId = tenantId;
    }

    if (assignedAdminId) {
      this.where.assignedAdminId = assignedAdminId;
    }

    if (search) {
      const trimmed = search.trim();
      this.where.OR = [
        {
          tenant: {
            firstName: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          tenant: {
            lastName: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          tenant: {
            email: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          tenant: {
            phone: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          tenant: {
            whatsappPhone: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          property: {
            title: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          property: {
            city: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          property: {
            district: {
              contains: trimmed,
              mode: "insensitive",
            },
          },
        },
        {
          note: {
            contains: trimmed,
            mode: "insensitive",
          },
        },
      ];
    }

    if (minPrice || maxPrice) {
      this.where.totalPrice = {};

      if (minPrice) {
        this.where.totalPrice.gte = Number(minPrice);
      }

      if (maxPrice) {
        this.where.totalPrice.lte = Number(maxPrice);
      }
    }

    if (bedsRequested) {
      const beds = Number(bedsRequested);
      if (Number.isInteger(beds) && beds > 0) {
        this.where.bedsRequested = beds;
      }
    }

    return this;
  }

  async execute(model = prisma.booking, options = {}) {
    const defaultSelectFields = {
      id: true,
      tenantId: true,
      propertyId: true,
      roomId: true,
      bedsRequested: true,
      monthsCount: true,
      totalPrice: true,
      startDate: true,
      endDate: true,
      status: true,
      note: true,
      contactedAt: true,
      createdAt: true,
      updatedAt: true,
      property: {
        select: {
          id: true,
          title: true,
          city: true,
          district: true,
          address: true,
          images: {
            where: { isPrimary: true },
            take: 1,
            select: {
              id: true,
              url: true,
              publicId: true,
            },
          },
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
      tenant: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          whatsappPhone: true,
          avatar: true,
        },
      },
      assignedAdmin: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      contract: {
        select: {
          id: true,
          contractNumber: true,
          status: true,
          tenantSignedAt: true,
          ownerSignedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    };

    const result = await super.execute(model, {
      ...options,
      select:
        options.select || (!options.include ? defaultSelectFields : undefined),
    });

    return {
      ...result,
      bookings: result.data,
    };
  }
}

export {
  BaseApiFeatures,
  BaseApiFeatures as ApiFeatures,
  PropertyApiFeatures,
  TicketApiFeatures,
  ContractApiFeatures,
  ReviewApiFeatures,
  ReportApiFeatures,
  NotificationApiFeatures,
  UserApiFeatures,
  BookingCalendarApiFeatures,
};

export default PropertyApiFeatures;
