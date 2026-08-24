import type { Request } from "express";

export function parsePagination(req: Request): { page: number; pageSize: number } {
  let page = 1;
  let pageSize = 10;

  if (req.query.page !== undefined) {
    const p = parseInt(req.query.page as string, 10);
    if (!isNaN(p) && p >= 1) {
      page = p;
    }
  }

  if (req.query.pageSize !== undefined) {
    const ps = parseInt(req.query.pageSize as string, 10);
    if (!isNaN(ps) && ps >= 1) {
      pageSize = Math.min(ps, 100);
    }
  }

  return { page, pageSize };
}
