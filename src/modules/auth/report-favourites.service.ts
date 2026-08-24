import { z } from "zod";
import {
  getCollectionItem,
  upsertCollectionItem,
} from "../collections/app-json-store.js";

/** Private AppJsonRow collection — not exposed via /api/collections gateway. */
export const USER_REPORT_FAVOURITES_COLLECTION = "userReportFavourites";

const payloadSchema = z.object({
  id: z.string().min(1),
  hrefs: z.array(z.string().min(1)).max(200),
  updatedAt: z.string().optional(),
});

export type UserReportFavouritesPayload = z.infer<typeof payloadSchema>;

function normalizeHrefs(hrefs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hrefs) {
    const href = raw.trim();
    if (!href || seen.has(href)) continue;
    seen.add(href);
    out.push(href);
  }
  return out;
}

export async function getUserReportFavourites(
  userId: string,
  organizationId: string
): Promise<string[]> {
  const raw = await getCollectionItem(
    USER_REPORT_FAVOURITES_COLLECTION,
    userId,
    organizationId
  );
  if (!raw) return [];
  const parsed = payloadSchema.safeParse(raw);
  if (!parsed.success) return [];
  return normalizeHrefs(parsed.data.hrefs);
}

export async function setUserReportFavourites(
  userId: string,
  organizationId: string,
  hrefs: string[]
): Promise<string[]> {
  const next = normalizeHrefs(hrefs);
  const payload: UserReportFavouritesPayload = {
    id: userId,
    hrefs: next,
    updatedAt: new Date().toISOString(),
  };
  await upsertCollectionItem(
    USER_REPORT_FAVOURITES_COLLECTION,
    userId,
    payload,
    organizationId
  );
  return next;
}
