/**
 * Resolve Twilio/Resend credentials for an organization.
 * Optional per-org overrides live in AppJsonRow collection `messagingSettings`
 * with entityId = organizationId (avoids global PK collisions). Missing fields
 * fall back to platform env credentials.
 */
import { prisma } from "./prisma.js";
import { env } from "../config/env.js";

export const MESSAGING_SETTINGS_COLLECTION = "messagingSettings";

export type OrgMessagingSettings = {
  twilioAccountSid?: string | null;
  twilioAuthToken?: string | null;
  twilioApiKeySid?: string | null;
  twilioApiKeySecret?: string | null;
  twilioFromNumber?: string | null;
  twilioWhatsappFrom?: string | null;
  twilioToNumberPrefix?: string | null;
  resendApiKey?: string | null;
  mailFrom?: string | null;
};

export type ResolvedMessagingCredentials = {
  organizationId: string;
  source: "organization" | "platform" | "mixed";
  twilioAccountSid: string | null;
  twilioAuthToken: string | null;
  twilioApiKeySid: string | null;
  twilioApiKeySecret: string | null;
  twilioFromNumber: string | null;
  twilioWhatsappFrom: string | null;
  twilioToNumberPrefix: string;
  resendApiKey: string | null;
  mailFrom: string | null;
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  hasOrgOverrides: boolean;
};

function trimOrNull(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

export function parseMessagingSettingsPayload(raw: unknown): OrgMessagingSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    twilioAccountSid: trimOrNull(o.twilioAccountSid),
    twilioAuthToken: trimOrNull(o.twilioAuthToken),
    twilioApiKeySid: trimOrNull(o.twilioApiKeySid),
    twilioApiKeySecret: trimOrNull(o.twilioApiKeySecret),
    twilioFromNumber: trimOrNull(o.twilioFromNumber),
    twilioWhatsappFrom: trimOrNull(o.twilioWhatsappFrom),
    twilioToNumberPrefix: trimOrNull(o.twilioToNumberPrefix),
    resendApiKey: trimOrNull(o.resendApiKey),
    mailFrom: trimOrNull(o.mailFrom),
  };
}

/** Public-safe view — never returns secret values. */
export function redactMessagingSettings(settings: OrgMessagingSettings): Record<string, unknown> {
  return {
    twilioAccountSidSet: Boolean(settings.twilioAccountSid),
    twilioAuthTokenSet: Boolean(settings.twilioAuthToken),
    twilioApiKeySidSet: Boolean(settings.twilioApiKeySid),
    twilioApiKeySecretSet: Boolean(settings.twilioApiKeySecret),
    twilioFromNumber: settings.twilioFromNumber ?? null,
    twilioWhatsappFrom: settings.twilioWhatsappFrom ?? null,
    twilioToNumberPrefix: settings.twilioToNumberPrefix ?? null,
    resendApiKeySet: Boolean(settings.resendApiKey),
    mailFrom: settings.mailFrom ?? null,
  };
}

export async function loadOrgMessagingSettings(
  organizationId: string
): Promise<OrgMessagingSettings> {
  const row = await prisma.appJsonRow.findUnique({
    where: {
      collection_entityId: {
        collection: MESSAGING_SETTINGS_COLLECTION,
        entityId: organizationId,
      },
    },
  });
  if (!row || row.organizationId !== organizationId) return {};
  return parseMessagingSettingsPayload(row.payload);
}

export async function saveOrgMessagingSettings(
  organizationId: string,
  patch: OrgMessagingSettings
): Promise<OrgMessagingSettings> {
  const current = await loadOrgMessagingSettings(organizationId);
  const next: OrgMessagingSettings = { ...current };
  for (const key of Object.keys(patch) as (keyof OrgMessagingSettings)[]) {
    if (patch[key] === undefined) continue;
    if (patch[key] === "") next[key] = null;
    else next[key] = patch[key] ?? null;
  }

  await prisma.appJsonRow.upsert({
    where: {
      collection_entityId: {
        collection: MESSAGING_SETTINGS_COLLECTION,
        entityId: organizationId,
      },
    },
    create: {
      collection: MESSAGING_SETTINGS_COLLECTION,
      entityId: organizationId,
      organizationId,
      payload: next as object,
    },
    update: {
      organizationId,
      payload: next as object,
    },
  });
  return next;
}

export async function resolveOrgMessagingCredentials(
  organizationId: string
): Promise<ResolvedMessagingCredentials> {
  const org = await loadOrgMessagingSettings(organizationId);
  const pick = (orgVal: string | null | undefined, envVal: string | undefined) =>
    orgVal ?? trimOrNull(envVal);

  const twilioAccountSid = pick(org.twilioAccountSid, env.TWILIO_ACCOUNT_SID);
  const twilioAuthToken = pick(org.twilioAuthToken, env.TWILIO_AUTH_TOKEN);
  const twilioApiKeySid = pick(org.twilioApiKeySid, env.TWILIO_API_KEY_SID);
  const twilioApiKeySecret = pick(org.twilioApiKeySecret, env.TWILIO_API_KEY_SECRET);
  const twilioFromNumber = pick(org.twilioFromNumber, env.TWILIO_FROM_NUMBER);
  const twilioWhatsappFrom = pick(org.twilioWhatsappFrom, env.TWILIO_WHATSAPP_FROM);
  const twilioToNumberPrefix =
    pick(org.twilioToNumberPrefix, env.TWILIO_TO_NUMBER_PREFIX) ?? "+91";
  const resendApiKey = pick(org.resendApiKey, env.RESEND_API_KEY);
  const mailFrom = pick(org.mailFrom, env.MAIL_FROM);

  const hasOrgOverrides = Object.values(org).some((v) => Boolean(v));
  const orgTwilio = Boolean(
    org.twilioAccountSid ||
      org.twilioAuthToken ||
      org.twilioApiKeySid ||
      org.twilioFromNumber ||
      org.twilioWhatsappFrom
  );
  const orgEmail = Boolean(org.resendApiKey || org.mailFrom);
  let source: ResolvedMessagingCredentials["source"] = "platform";
  if (hasOrgOverrides) {
    source = orgTwilio && orgEmail ? "organization" : "mixed";
  }

  const accountOk = Boolean(twilioAccountSid);
  const authOk = Boolean(twilioAuthToken) || Boolean(twilioApiKeySid && twilioApiKeySecret);

  return {
    organizationId,
    source,
    twilioAccountSid,
    twilioAuthToken,
    twilioApiKeySid,
    twilioApiKeySecret,
    twilioFromNumber,
    twilioWhatsappFrom,
    twilioToNumberPrefix,
    resendApiKey,
    mailFrom,
    smsEnabled: accountOk && authOk && Boolean(twilioFromNumber),
    whatsappEnabled: accountOk && authOk && Boolean(twilioWhatsappFrom),
    emailEnabled: Boolean(resendApiKey),
    hasOrgOverrides,
  };
}
