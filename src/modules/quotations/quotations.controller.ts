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
  deleteQuotation,
  listQuotations,
  replaceQuotations,
  upsertQuotation,
} from "./quotations.service.js";

const COLLECTION = "quotations" as const;
const snapshotSchema = z.object({ items: z.array(z.unknown()) });

export async function getQuotations(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await resolveDocumentListScope(req);
    if (scope.kind === "empty") {
      res.json({ data: { items: [] }, error: null });
      return;
    }
    const items = await listQuotations(scope.scope.organizationId, scope.allowedBranchIds);
    res.json({ data: { items }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postQuotationsSnapshot(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = snapshotSchema.parse(req.body);
    const items = parseCollectionSnapshotItems(COLLECTION, body.items);
    await replaceQuotations(org.organizationId, items);
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function putQuotation(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const entityId = entityIdParam(req);
    const payload = parseCollectionPayload(COLLECTION, req.body);
    assertPayloadEntityIdMatch(COLLECTION, entityId, payload);
    await upsertQuotation(org.organizationId, entityId, payload);
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function deleteQuotationRow(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const ok = await deleteQuotation(org.organizationId, entityIdParam(req));
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
