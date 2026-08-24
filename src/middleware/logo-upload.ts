import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { isAllowedAvatarMime } from "../lib/avatar-mimes.js";

/** Maximum multipart body size for company logo uploads (JPEG/PNG/WebP/GIF). */
const LOGO_MAX_FILE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAvatarMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a JPEG, PNG, WebP, or GIF image."));
    }
  },
});

/** Parses multipart field `logo`; responds with 400 on multer errors (never calls next). */
export function logoUploadHandler(req: Request, res: Response, next: NextFunction): void {
  upload.single("logo")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          data: null,
          error: { message: "Logo must be 5 MB or smaller." },
        });
        return;
      }
      const msg = err instanceof Error ? err.message : "Upload failed.";
      res.status(400).json({ data: null, error: { message: msg } });
      return;
    }
    next();
  });
}
