import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { isAllowedAvatarMime } from "../lib/avatar-mimes.js";

/** Maximum multipart body size for profile avatar uploads (JPEG/PNG/WebP/GIF). */
const AVATAR_MAX_FILE_BYTES = 5 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: AVATAR_MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (isAllowedAvatarMime(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Please upload a JPEG, PNG, WebP, or GIF image."));
    }
  },
});

/** Parses multipart field `avatar`; responds with 400 on multer errors (never calls next). */
export function avatarUploadHandler(req: Request, res: Response, next: NextFunction): void {
  upload.single("avatar")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          data: null,
          error: { message: "Image must be 5 MB or smaller." },
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
