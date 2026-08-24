import { prisma } from "../../lib/prisma.js";
import { getCollectionItem } from "../collections/app-json-store.js";
import { AppError } from "../../lib/app-error.js";
import { toApiVehicle } from "../vehicles/vehicle-api.service.js";

/** Public-safe business settings fields for tax invoice HTML. */
const PUBLIC_SETTINGS_KEYS = [
  "gstRegistrationStatus",
  "businessName",
  "businessTagline",
  "businessAddress",
  "businessPhone",
  "businessWhatsApp",
  "businessEmail",
  "businessWebsite",
  "gstin",
  "companyPan",
  "bankName",
  "bankBranch",
  "bankAccountNumber",
  "bankIfsc",
  "bankUpi",
  "logoUrl",
] as const;

/** Job-card fields needed by the public invoice print template. */
const PUBLIC_JOB_CARD_KEYS = [
  "id",
  "jobNumber",
  "customerName",
  "customerPhone",
  "customerEmail",
  "customerAddress",
  "vehicleId",
  "vehicleMakeModel",
  "vehicleRegNumber",
  "vehicleSegment",
  "odometerReading",
  "createdAt",
  "expectedDelivery",
  "actualDelivery",
  "status",
] as const;

/** Vehicle fields shown under make/model on the public invoice. */
const PUBLIC_VEHICLE_KEYS = [
  "id",
  "variant",
  "year",
  "fuelType",
  "color",
  "odometer",
  "make",
  "model",
] as const;

function pickKeys(source: Record<string, unknown> | null | undefined, keys: readonly string[]) {
  if (!source) return null;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in source) out[key] = source[key];
  }
  return out;
}

function sanitizeInvoiceForPublic(invoice: Record<string, unknown>): Record<string, unknown> {
  const { storedPdf: _storedPdf, ...rest } = invoice;
  return rest;
}

/**
 * Load a minimized public invoice view (no auth).
 * Omits other customer invoices, all-branch dumps, and sensitive settings/PDF blobs.
 */
export async function getPublicInvoiceView(invoiceId: string) {
  const invoiceRaw = (await getCollectionItem("invoices", invoiceId)) as Record<
    string,
    unknown
  > | null;
  if (!invoiceRaw) {
    throw AppError.notFound("Invoice not found");
  }

  const jobCardId = typeof invoiceRaw.jobCardId === "string" ? invoiceRaw.jobCardId : "";
  const jobCardRaw = jobCardId
    ? ((await getCollectionItem("jobCards", jobCardId)) as Record<string, unknown> | null)
    : null;

  const vehicleId =
    jobCardRaw && typeof jobCardRaw.vehicleId === "string" ? jobCardRaw.vehicleId : "";
  const vehicleRow = vehicleId
    ? await prisma.vehicle.findUnique({ where: { id: vehicleId } })
    : null;
  const vehicleApi = vehicleRow ? toApiVehicle(vehicleRow) : null;

  const settingsRow = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection: "appSettings", entityId: "default" } },
  });
  const settingsPayload =
    settingsRow?.payload && typeof settingsRow.payload === "object"
      ? (settingsRow.payload as Record<string, unknown>)
      : null;

  return {
    invoice: sanitizeInvoiceForPublic(invoiceRaw),
    jobCard: pickKeys(jobCardRaw ?? undefined, PUBLIC_JOB_CARD_KEYS),
    vehicle: pickKeys(
      vehicleApi ? (vehicleApi as unknown as Record<string, unknown>) : undefined,
      PUBLIC_VEHICLE_KEYS
    ),
    businessSettings: pickKeys(settingsPayload ?? undefined, PUBLIC_SETTINGS_KEYS),
  };
}
