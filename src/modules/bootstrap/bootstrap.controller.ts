import type { Request, Response, NextFunction } from "express";
import { getBootstrapPayload } from "./bootstrap.service.js";

export async function getBootstrap(req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getBootstrapPayload(req.auth);
    res.json({ data, error: null });
  } catch (e) {
    next(e);
  }
}
