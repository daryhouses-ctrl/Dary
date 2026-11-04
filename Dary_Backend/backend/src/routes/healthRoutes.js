import { Router } from "express";
import {
  getLiveness,
  getReadiness,
  getDeepHealth,
  getDbHealth,
  getHealthMetrics,
} from "../controllers/healthController.js";

const router = Router();

// Liveness
router.get("/livez", getLiveness);

// Readiness
router.get("/readyz", getReadiness);

// Deep health check
router.get("/health/deep", getDeepHealth);

// Database health & Connection Pool Monitor
router.get("/health/db", getDbHealth);

router.get("/health/metrics", getHealthMetrics);

// General health check
router.get("/health", getReadiness);

export default router;
