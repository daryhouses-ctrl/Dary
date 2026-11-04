import jwt from "jsonwebtoken";
import { prisma } from "../../config/prisma/PrismaService.js";
import { getMemoryCache, setMemoryCache } from "../../utils/memoryCache.js";

const inFlightUserStatus = new Map();

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  let bearerToken = null;
  if (authHeader && typeof authHeader === "string") {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      bearerToken = trimmed.slice(7).trim();
    } else if (!trimmed.includes(" ") && trimmed.length > 20) {
      bearerToken = trimmed;
    }
  }

  const cookieToken =
    req.cookies?.AccessToken ||
    req.cookies?.accessToken ||
    req.cookies?.token ||
    req.cookies?.jwt;

  const token = bearerToken || cookieToken;

  if (!token) {
    return res.status(401).json({
      success: false,
      code: "NO_TOKEN",
      message: req.t ? req.t("token.noAccessTokenProvided") : "No access token provided",
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    const userId = payload.sub;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: req.t("token.invalidTokenPayload"),
      });
    }

    const cacheKey = `user:status:${userId}`;
    let user = getMemoryCache(cacheKey);

    if (!user) {
      if (inFlightUserStatus.has(cacheKey)) {
        user = await inFlightUserStatus.get(cacheKey);
      } else {
        const fetchPromise = (async () => {
          try {
            const fetched = await prisma.user.findFirst({
              where: {
                id: userId,
                deletedAt: null,
              },
              select: {
                id: true,
                status: true,
              },
            });
            if (fetched) {
              setMemoryCache(cacheKey, fetched, 60);
            }
            return fetched;
          } finally {
            inFlightUserStatus.delete(cacheKey);
          }
        })();

        inFlightUserStatus.set(cacheKey, fetchPromise);
        user = await fetchPromise;
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: req.t("common.userNotFound"),
      });
    }

    if (user.status === "SUSPENDED") {
      return res.status(403).json({
        success: false,
        message: req.t("common.accountSuspended"),
      });
    }

    if (user.status === "INACTIVE") {
      return res.status(403).json({
        success: false,
        message: req.t("common.accountInactive"),
      });
    }

    req.user = {
      id: user.id,
      email: payload.email,
      roles: payload.roles,
    };

    next();
  } catch (error) {
    const isExpired = error.name === "TokenExpiredError";
    const message = isExpired
      ? (req.t ? req.t("token.accessTokenExpired") : "Access token expired")
      : (req.t ? req.t("token.invalidOrExpiredAccessToken") : "Invalid access token");

    return res.status(401).json({
      success: false,
      code: isExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
      message,
    });
  }
};

export const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  let bearerToken = null;
  if (authHeader && typeof authHeader === "string") {
    const trimmed = authHeader.trim();
    if (trimmed.toLowerCase().startsWith("bearer ")) {
      bearerToken = trimmed.slice(7).trim();
    } else if (!trimmed.includes(" ") && trimmed.length > 20) {
      bearerToken = trimmed;
    }
  }

  const cookieToken =
    req.cookies?.AccessToken ||
    req.cookies?.accessToken ||
    req.cookies?.token ||
    req.cookies?.jwt;

  const token = bearerToken || cookieToken;

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    if (payload?.sub) {
      req.user = {
        id: payload.sub,
        email: payload.email,
        roles: Array.isArray(payload.roles) ? payload.roles : [],
      };
    }
  } catch {
    // Guest or expired token - proceed without throwing
  }

  next();
};

export default authMiddleware;
