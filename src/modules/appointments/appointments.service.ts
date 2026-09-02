/**
 * Appointments domain service.
 * HTTP: `/api/collections/appointments`.
 */
import {
  deleteCollectionItem,
  getCollectionItem,
  listCollectionItems,
  replaceCollectionArray,
  upsertCollectionItem,
} from "../collections/app-json-store.js";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";

type JsonRecord = Record<string, unknown>;

let appointmentTableAvailable: boolean | null = null;

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function normalizeAppointmentPayload(payload: unknown, previous: unknown | null): unknown {
  const next = asRecord(payload);
  if (!next) return payload;

  const prev = asRecord(previous);
  const out: JsonRecord = { ...next };

  if (out.vehiclePickupRequired === undefined) {
    out.vehiclePickupRequired = prev?.vehiclePickupRequired ?? null;
  }
  if (out.vehiclePickupStatus === undefined) {
    out.vehiclePickupStatus = prev?.vehiclePickupStatus ?? null;
  }

  return out;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isMissingAppointmentTableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = "message" in err ? String((err as { message?: unknown }).message ?? "") : "";
  return msg.includes('The table `public.Appointment` does not exist');
}

async function hasAppointmentTable(): Promise<boolean> {
  if (appointmentTableAvailable !== null) return appointmentTableAvailable;
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Appointment'
      ) AS "exists"
    `;
    appointmentTableAvailable = Boolean(rows[0]?.exists);
  } catch {
    appointmentTableAvailable = false;
  }
  return appointmentTableAvailable;
}

async function upsertAppointmentRow(
  organizationId: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  if (!(await hasAppointmentTable())) return;

  const doc = asRecord(payload);
  if (!doc) return;

  try {
    await prisma.appointment.upsert({
      where: { id: entityId },
      create: {
        id: entityId,
        organizationId,
        bookingId: asString(doc.bookingId),
        appointmentNumber: asString(doc.appointmentNumber),
        kind: asString(doc.kind),
        branchId: asString(doc.branchId),
        customerId: asString(doc.customerId),
        customerName: asString(doc.customerName),
        customerPhone: asString(doc.customerPhone),
        vehicleId: asString(doc.vehicleId),
        vehicleRegNumber: asString(doc.vehicleRegNumber),
        vehicleMakeModel: asString(doc.vehicleMakeModel),
        serviceType: asString(doc.serviceType),
        mechanicId: asString(doc.mechanicId),
        mechanicName: asString(doc.mechanicName),
        date: asString(doc.date),
        time: asString(doc.time),
        status: asString(doc.status),
        jobCardId: asString(doc.jobCardId),
        notes: asString(doc.notes),
        whatsappSent: asBoolean(doc.whatsappSent),
        reminderSent: asBoolean(doc.reminderSent),
        priceGrandTotal: asNumber(doc.priceGrandTotal),
        advancePaid: asNumber(doc.advancePaid),
        customerAddress: asString(doc.customerAddress),
        vehiclePickupRequired: asBoolean(doc.vehiclePickupRequired),
        vehiclePickupStatus: asString(doc.vehiclePickupStatus),
        payload: doc as Prisma.InputJsonValue,
      },
      update: {
        organizationId,
        bookingId: asString(doc.bookingId),
        appointmentNumber: asString(doc.appointmentNumber),
        kind: asString(doc.kind),
        branchId: asString(doc.branchId),
        customerId: asString(doc.customerId),
        customerName: asString(doc.customerName),
        customerPhone: asString(doc.customerPhone),
        vehicleId: asString(doc.vehicleId),
        vehicleRegNumber: asString(doc.vehicleRegNumber),
        vehicleMakeModel: asString(doc.vehicleMakeModel),
        serviceType: asString(doc.serviceType),
        mechanicId: asString(doc.mechanicId),
        mechanicName: asString(doc.mechanicName),
        date: asString(doc.date),
        time: asString(doc.time),
        status: asString(doc.status),
        jobCardId: asString(doc.jobCardId),
        notes: asString(doc.notes),
        whatsappSent: asBoolean(doc.whatsappSent),
        reminderSent: asBoolean(doc.reminderSent),
        priceGrandTotal: asNumber(doc.priceGrandTotal),
        advancePaid: asNumber(doc.advancePaid),
        customerAddress: asString(doc.customerAddress),
        vehiclePickupRequired: asBoolean(doc.vehiclePickupRequired),
        vehiclePickupStatus: asString(doc.vehiclePickupStatus),
        payload: doc as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    if (isMissingAppointmentTableError(err)) {
      appointmentTableAvailable = false;
      return;
    }
    throw err;
  }
}

export async function listAppointments(
  organizationId: string,
  allowedBranchIds?: string[] | null,
  opts?: { page?: number; pageSize?: number }
) {
  return listCollectionItems("appointments", { organizationId, allowedBranchIds, ...opts });
}

export async function getAppointment(organizationId: string, entityId: string) {
  return getCollectionItem("appointments", entityId, organizationId);
}

export async function upsertAppointment(
  organizationId: string,
  entityId: string,
  payload: unknown,
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<void> {
  const previous = await getCollectionItem("appointments", entityId, organizationId);
  const normalized = normalizeAppointmentPayload(payload, previous);
  await upsertCollectionItem("appointments", entityId, normalized, organizationId, ctx);
  await upsertAppointmentRow(organizationId, entityId, normalized);
  await syncPickupDropRequest(organizationId, entityId, normalized, previous, ctx);
}

/**
 * Auto-create / remove a `pickupDropRequests` entry whenever an appointment
 * has vehiclePickupRequired toggled. The entity id is `pnd-<appointmentId>`.
 * This is the source of truth — the frontend has no separate write for P&D.
 */
async function syncPickupDropRequest(
  organizationId: string,
  appointmentId: string,
  payload: unknown,
  previous: unknown | null,
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<void> {
  const doc = asRecord(payload);
  if (!doc) return;

  const pickupId  = `pnd-pickup-${appointmentId}`;
  const dropId    = `pnd-drop-${appointmentId}`;
  const pickupRequired = asBoolean(doc.vehiclePickupRequired);

  if (pickupRequired === true) {
    const baseFields = {
      appointmentId,
      bookingId: asString(doc.bookingId) ?? appointmentId,
      appointmentNumber: asString(doc.appointmentNumber),
      customerId: asString(doc.customerId),
      customerName: asString(doc.customerName),
      customerPhone: asString(doc.customerPhone),
      customerAddress: asString(doc.customerAddress),
      vehicleId: asString(doc.vehicleId),
      vehicleRegNumber: asString(doc.vehicleRegNumber),
      vehicleMakeModel: asString(doc.vehicleMakeModel),
      branchId: asString(doc.branchId),
      date: asString(doc.date),
      time: asString(doc.time),
      serviceType: asString(doc.serviceType),
      createdAt: asString(doc.createdAt) ?? new Date().toISOString(),
    };

    // Driver fields from booking payload
    const pickupDriverId   = asString(doc.pickupDriverId);
    const pickupDriverName = asString(doc.pickupDriverName);
    const dropDriverId     = asString(doc.dropDriverId);
    const dropDriverName   = asString(doc.dropDriverName);

    // 1. PICKUP — collect vehicle from customer address → workshop
    const existingPickup = await getCollectionItem("pickupDropRequests", pickupId, organizationId) as Record<string, unknown> | null;
    const pickupStatus = existingPickup?.status ?? "PENDING";
    await upsertCollectionItem("pickupDropRequests", pickupId, {
      ...baseFields,
      id: pickupId,
      requestType: "PICKUP",
      status: pickupStatus,
      vehiclePickupStatus: asString(existingPickup?.vehiclePickupStatus) ?? "PENDING",
      // Prefer booking-level driver; fall back to whatever was already assigned on the P&D row
      driverId:   pickupDriverId   ?? asString(existingPickup?.driverId)   ?? null,
      driverName: pickupDriverName ?? asString(existingPickup?.driverName) ?? null,
    }, organizationId, ctx);

    // 2. DROP OFF — return vehicle from workshop → customer address
    const existingDrop = await getCollectionItem("pickupDropRequests", dropId, organizationId) as Record<string, unknown> | null;
    const dropStatus = existingDrop?.status ?? "PENDING";
    await upsertCollectionItem("pickupDropRequests", dropId, {
      ...baseFields,
      id: dropId,
      requestType: "DROP_OFF",
      status: dropStatus,
      vehiclePickupStatus: asString(existingDrop?.vehiclePickupStatus) ?? "PENDING",
      driverId:   dropDriverId   ?? asString(existingDrop?.driverId)   ?? null,
      driverName: dropDriverName ?? asString(existingDrop?.driverName) ?? null,
    }, organizationId, ctx);

  } else if (pickupRequired === false) {
    // vehiclePickupRequired explicitly set to false — remove both P&D entries.
    const prevRequired = asBoolean(asRecord(previous)?.vehiclePickupRequired);
    if (prevRequired === true) {
      await deleteCollectionItem("pickupDropRequests", pickupId, organizationId, ctx);
      await deleteCollectionItem("pickupDropRequests", dropId, organizationId, ctx);
    }
  }
}

export async function deleteAppointment(
  organizationId: string,
  entityId: string,
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<boolean> {
  const deleted = await deleteCollectionItem("appointments", entityId, organizationId, ctx);
  if (!deleted) return false;
  // Remove both P&D entries if they exist.
  await deleteCollectionItem("pickupDropRequests", `pnd-pickup-${entityId}`, organizationId, ctx);
  await deleteCollectionItem("pickupDropRequests", `pnd-drop-${entityId}`, organizationId, ctx);
  if (await hasAppointmentTable()) {
    try {
      await prisma.appointment.deleteMany({ where: { id: entityId, organizationId } });
    } catch (err) {
      if (!isMissingAppointmentTableError(err)) throw err;
      appointmentTableAvailable = false;
    }
  }
  return true;
}

export async function replaceAppointments(
  organizationId: string,
  items: { id: string }[],
  ctx?: import("../collections/collection.dispatcher.js").CollectionWriteContext
): Promise<void> {
  const existingRaw = await listCollectionItems("appointments", { organizationId });
  const existing = Array.isArray(existingRaw) ? existingRaw : existingRaw.items;
  const prevById = new Map<string, unknown>();

  for (const row of existing) {
    if (row && typeof row === "object" && typeof (row as { id?: string }).id === "string") {
      prevById.set((row as { id: string }).id, row);
    }
  }

  const normalized = items.map((item) => {
    const previous = prevById.get(item.id) ?? null;
    return normalizeAppointmentPayload(item, previous) as { id: string };
  });

  await replaceCollectionArray("appointments", normalized, organizationId, ctx);
  for (const item of normalized) {
    await upsertAppointmentRow(organizationId, item.id, item);
  }
}