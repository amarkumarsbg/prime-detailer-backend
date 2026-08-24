import { Router } from "express";
import { requireAuth, requirePermission, requireAnyPermission } from "../../middleware/auth.js";
import { getUsers, getStaffDirectory, postUser, putUser } from "./user-api.controller.js";

export const userApiRouter = Router();

userApiRouter.use(requireAuth);

/** Operational directory — no STAFF permission; sensitive fields stripped. */
userApiRouter.get(
  "/directory",
  requireAnyPermission([
    "STAFF",
    "JOB_CARDS",
    "APPOINTMENTS",
    "PICKUP_DROP",
    "ATTENDANCE",
    "BOOKINGS",
    "PAYROLL",
    "MECHANICS",
  ]),
  getStaffDirectory
);

userApiRouter.use(requirePermission("STAFF"));

userApiRouter.get("/", getUsers);
userApiRouter.post("/", postUser);
userApiRouter.put("/:id", putUser);
