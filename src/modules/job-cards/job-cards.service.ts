/**
 * Job Cards domain service.
 * HTTP: `/api/job-cards` aliases + `/api/collections/jobCards` (+ photo upload).
 */
import { AppError } from "../../lib/app-error.js";
import {
  evaluateJobCardPricingWrite,
  type JobCardLike,
} from "../../lib/job-card-pricing-guard.js";
import {
  getCollectionItem,
  listCollectionItems,
  replaceCollectionArray,
  upsertCollectionItem,
  deleteCollectionItem,
} from "../collections/app-json-store.js";

export type JobCardWriteContext = {
  organizationId: string;
  hasPricingPermission: boolean;
};

async function invoiceExistsForJobCard(
  organizationId: string,
  jobCardId: string
): Promise<boolean> {
  const invoices = await listCollectionItems("invoices", { organizationId });
  return invoices.some((raw) => {
    if (!raw || typeof raw !== "object") return false;
    return (raw as { jobCardId?: string }).jobCardId === jobCardId;
  });
}

export async function assertJobCardPricingAllowed(
  organizationId: string,
  prev: unknown | null,
  next: unknown,
  ctx: Pick<JobCardWriteContext, "hasPricingPermission">
): Promise<void> {
  if (!prev || typeof prev !== "object") return;
  if (!next || typeof next !== "object") return;
  const prevJc = prev as JobCardLike & { id?: string };
  const nextJc = next as JobCardLike & { id?: string };
  const jobId =
    typeof nextJc.id === "string" ? nextJc.id : typeof prevJc.id === "string" ? prevJc.id : "";
  const hasInvoice = jobId ? await invoiceExistsForJobCard(organizationId, jobId) : false;
  const decision = evaluateJobCardPricingWrite({
    hasPricingPermission: ctx.hasPricingPermission,
    prev: prevJc,
    next: nextJc,
    hasInvoice,
  });
  if (decision.ok) return;
  throw AppError.forbidden(decision.message);
}

export async function listJobCards(
  organizationId: string,
  allowedBranchIds?: string[] | null
) {
  return listCollectionItems("jobCards", { organizationId, allowedBranchIds });
}

export async function getJobCard(organizationId: string, entityId: string) {
  return getCollectionItem("jobCards", entityId, organizationId);
}

export async function upsertJobCard(
  entityId: string,
  payload: unknown,
  ctx: JobCardWriteContext
): Promise<void> {
  const prev = await getCollectionItem("jobCards", entityId, ctx.organizationId);
  await assertJobCardPricingAllowed(ctx.organizationId, prev, payload, ctx);
  await upsertCollectionItem("jobCards", entityId, payload, ctx.organizationId);
}

export async function replaceJobCards(
  items: { id: string }[],
  ctx: JobCardWriteContext
): Promise<void> {
  const existing = await listCollectionItems("jobCards", {
    organizationId: ctx.organizationId,
  });
  const prevById = new Map<string, unknown>();
  for (const row of existing) {
    if (row && typeof row === "object" && typeof (row as { id?: string }).id === "string") {
      prevById.set((row as { id: string }).id, row);
    }
  }
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const id = (item as { id?: string }).id;
    if (typeof id !== "string" || !id) continue;
    const prev = prevById.get(id) ?? null;
    await assertJobCardPricingAllowed(ctx.organizationId, prev, item, ctx);
  }
  await replaceCollectionArray("jobCards", items, ctx.organizationId);
}

export async function deleteJobCard(organizationId: string, entityId: string): Promise<boolean> {
  return deleteCollectionItem("jobCards", entityId, organizationId);
}
