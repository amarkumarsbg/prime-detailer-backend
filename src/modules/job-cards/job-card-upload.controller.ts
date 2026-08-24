import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { persistJobInspectionPhoto } from "../../services/object-storage.service.js";

function jobCardIdParam(req: Request): string {
  const raw = req.params.jobCardId;
  return Array.isArray(raw) ? raw[0]! : raw!;
}

const photoTypeSchema = z.enum(["BEFORE", "AFTER"]);

/** Authenticated upload for job-card inspection photos; stores URL-returnable path for `InspectionPhoto.url`. */
export async function postJobCardInspectionPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const jobCardId = jobCardIdParam(req).trim();
    if (!jobCardId) {
      res.status(400).json({ data: null, error: { message: "Missing job card id." } });
      return;
    }

    const typeRaw = typeof req.query.type === "string" ? req.query.type.trim() : "";
    const typeNormalized = typeRaw.toUpperCase();
    const typeParsed = photoTypeSchema.safeParse(typeNormalized);
    if (!typeParsed.success) {
      res.status(400).json({
        data: null,
        error: { message: "Query ?type=BEFORE or ?type=AFTER is required." },
      });
      return;
    }

    const pidRaw = typeof req.query.photoId === "string" ? req.query.photoId.trim() : "";
    const photoId =
      pidRaw.replace(/[^\w-]/g, "_").slice(0, 96) ||
      `ph-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    const file = req.file;
    if (!file?.buffer) {
      res.status(400).json({ data: null, error: { message: "No image file provided." } });
      return;
    }

    const url = await persistJobInspectionPhoto({
      jobCardId,
      kind: typeParsed.data === "BEFORE" ? "before" : "after",
      photoId,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });

    res.status(201).json({ data: { url }, error: null });
  } catch (e) {
    next(e);
  }
}
