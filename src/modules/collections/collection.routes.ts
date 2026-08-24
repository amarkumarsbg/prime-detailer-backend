import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { requireAuth, requirePermission } from "../../middleware/auth.js";
import { getCollectionPermission } from "../../constants/collection-permissions.js";
import {
  getCollection,
  postSnapshot,
  putCollectionItem,
  deleteCollectionRow,
  postAppSettingsLogo,
} from "./collection.controller.js";
import { logoUploadHandler } from "../../middleware/logo-upload.js";

export const collectionRouter = Router();

collectionRouter.use(requireAuth);

collectionRouter.post(
  "/appSettings/logo",
  requirePermission("SETTINGS"),
  logoUploadHandler,
  postAppSettingsLogo
);

/**
 * Default-deny: collection must be mapped to a permission, and the user must hold it
 * (SUPER_ADMIN bypasses inside requirePermission / here).
 */
export function requireCollectionPermission(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ data: null, error: { message: "Unauthorized" } });
    return;
  }
  if (req.auth.role === "SUPER_ADMIN") {
    next();
    return;
  }
  const collection = req.params.collection;
  if (typeof collection !== "string") {
    res.status(403).json({ data: null, error: { message: "Forbidden: Unknown collection" } });
    return;
  }
  const permission = getCollectionPermission(collection);
  if (!permission) {
    res.status(403).json({
      data: null,
      error: { message: `Forbidden: No permission mapping for collection ${collection}` },
    });
    return;
  }
  if (!req.auth.permissions || !req.auth.permissions.includes(permission)) {
    res.status(403).json({
      data: null,
      error: { message: `Forbidden: Missing permission ${permission}` },
    });
    return;
  }
  next();
}

collectionRouter.get("/:collection", requireCollectionPermission, getCollection);
collectionRouter.post("/:collection/snapshot", requireCollectionPermission, postSnapshot);
collectionRouter.put("/:collection/:entityId", requireCollectionPermission, putCollectionItem);
collectionRouter.delete("/:collection/:entityId", requireCollectionPermission, deleteCollectionRow);
