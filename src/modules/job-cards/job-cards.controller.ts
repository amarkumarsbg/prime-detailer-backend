import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  assertPayloadEntityIdMatch,
  parseCollectionPayload,
  parseCollectionSnapshotItems,
} from "../../validations/collection-payloads.js";
import {
  entityIdParam,
  hasJobCardPricingPermission,
  requireDocumentOrg,
  resolveDocumentListScope,
} from "../collections/alias-http.js";
import {
  deleteJobCard,
  listJobCards,
  replaceJobCards,
  upsertJobCard,
} from "./job-cards.service.js";
import { generateJobCardSecureToken } from "../../lib/secure-token.js";

const COLLECTION = "jobCards" as const;
const snapshotSchema = z.object({ items: z.array(z.unknown()) });

export async function getJobCards(req: Request, res: Response, next: NextFunction) {
  try {
    const scope = await resolveDocumentListScope(req);
    if (scope.kind === "empty") {
      res.json({ data: { items: [] }, error: null });
      return;
    }
    const items = await listJobCards(scope.scope.organizationId, scope.allowedBranchIds);
    const itemsWithTokens = items.map((item: any) => {
      if (item && typeof item === "object" && typeof item.id === "string") {
        return {
          ...item,
          secureToken: generateJobCardSecureToken(item.id),
        };
      }
      return item;
    });
    res.json({ data: { items: itemsWithTokens }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function postJobCardsSnapshot(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const body = snapshotSchema.parse(req.body);
    const items = parseCollectionSnapshotItems(COLLECTION, body.items);
    await replaceJobCards(items, {
      organizationId: org.organizationId,
      hasPricingPermission: hasJobCardPricingPermission(req),
    });
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function putJobCard(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const entityId = entityIdParam(req);
    const payload = parseCollectionPayload(COLLECTION, req.body);
    assertPayloadEntityIdMatch(COLLECTION, entityId, payload);
    await upsertJobCard(entityId, payload, {
      organizationId: org.organizationId,
      hasPricingPermission: hasJobCardPricingPermission(req),
    });
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}

export async function deleteJobCardRow(req: Request, res: Response, next: NextFunction) {
  try {
    const org = await requireDocumentOrg(req);
    if (!org) {
      res.status(401).json({ data: null, error: { message: "Unauthorized" } });
      return;
    }
    const ok = await deleteJobCard(org.organizationId, entityIdParam(req));
    if (!ok) {
      res.status(404).json({ data: null, error: { message: "Not found" } });
      return;
    }
    res.json({ data: { ok: true }, error: null });
  } catch (e) {
    next(e);
  }
}
