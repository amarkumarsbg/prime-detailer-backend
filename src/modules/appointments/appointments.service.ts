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

async function upsertAppointmentRow(
  organizationId: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  const doc = asRecord(payload);
  if (!doc) return;

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
}

export async function listAppointments(
  organizationId: string,
  allowedBranchIds?: string[] | null
) {
  return listCollectionItems("appointments", { organizationId, allowedBranchIds });
}

export async function getAppointment(organizationId: string, entityId: string) {
  return getCollectionItem("appointments", entityId, organizationId);
}

export async function upsertAppointment(
  organizationId: string,
  entityId: string,
  payload: unknown
): Promise<void> {
  const previous = await getCollectionItem("appointments", entityId, organizationId);
  const normalized = normalizeAppointmentPayload(payload, previous);
  await upsertCollectionItem("appointments", entityId, normalized, organizationId);
  await upsertAppointmentRow(organizationId, entityId, normalized);
}

export async function deleteAppointment(
  organizationId: string,
  entityId: string
): Promise<boolean> {
  const deleted = await deleteCollectionItem("appointments", entityId, organizationId);
  if (!deleted) return false;
  await prisma.appointment.deleteMany({ where: { id: entityId, organizationId } });
  return true;
}

export async function replaceAppointments(
  organizationId: string,
  items: { id: string }[]
): Promise<void> {
  const existing = await listCollectionItems("appointments", { organizationId });
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

  await replaceCollectionArray("appointments", normalized, organizationId);
  for (const item of normalized) {
    await upsertAppointmentRow(organizationId, item.id, item);
  }
}