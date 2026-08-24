import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  assertPayloadEntityIdMatch,
  parseCollectionPayload,
  parseCollectionSnapshotItems,
} from "../../validations/collection-payloads.js";
import {
  entityIdParam,
  requireDocumentOrg,
  resolveDocumentListScope,
} from "../collections/alias-http.js";
import {
  deleteInvoice,
  listInvoices,
  replaceInvoices,
  upsertInvoice,
} from "./invoices.service.js";
import { parsePagination } from "../../lib/pagination.js";

const COLLECTION = "invoices" as const;
const snapshotSchema = z.object({ items: z.array(z.unknown()) });

export async function getInvoices(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await resolveDocumentListScope(req);
    if (scope.kind === "empty") {
      res.json({ data: { items: [] }, error: null });
      return;
    }
    const { page, pageSize } = parsePagination(req);
    const result = await listInvoices(scope.scope.organizationId, scope.allowedBranchIds, { page, pageSize });
    if (Array.isArray(result)) {
      res.json({ data: { items: result }, error: null });
    } else {
      res.json({ data: result, error: null });
    }
  } catch (e) {
    next(e);
  }
}

export async function postInvoicesSnapshot(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = snapshotSchema.parse(req.body);
    const items = parseCollectionSnapshotItems(COLLECTION, body.items);
    await replaceInvoices(org.organizationId, items);
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function putInvoice(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const entityId = entityIdParam(req);
    const payload = parseCollectionPayload(COLLECTION, req.body);
    assertPayloadEntityIdMatch(COLLECTION, entityId, payload);
    await upsertInvoice(org.organizationId, entityId, payload);
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function deleteInvoiceRow(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const ok = await deleteInvoice(org.organizationId, entityIdParam(req));
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
