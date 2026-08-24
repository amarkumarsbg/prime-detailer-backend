import { prisma } from "../lib/prisma.js";
import { SINGLETON_ENTITY_ID } from "../constants/json-collections.js";

export type PublicLoginHeroFeature = {
  title: string;
  description: string;
};

export type PublicBranding = {
  businessName: string;
  businessLogo: string;
  brandPrimary: string;
  loginBackgroundImage: string;
  loginHeroHeading: string;
  loginHeroDescription: string;
  loginHeroFeatures: PublicLoginHeroFeature[];
};

const DEFAULT_HEADING = "Manage your business smarter, not harder.";
const DEFAULT_DESCRIPTION =
  "The all-in-one platform to streamline operations, track services, and grow your automotive business.";
const DEFAULT_FEATURES: PublicLoginHeroFeature[] = [
  {
    title: "Vehicle Tracking",
    description: "Complete service history at your fingertips",
  },
  {
    title: "Real-time Dashboard",
    description: "Monitor KPIs and daily operations live",
  },
  {
    title: "Secure & Reliable",
    description: "Enterprise-grade data protection",
  },
];

const DEFAULTS: PublicBranding = {
  businessName: "Prime Detailers",
  businessLogo: "",
  brandPrimary: "#3B82F6",
  loginBackgroundImage: "",
  loginHeroHeading: DEFAULT_HEADING,
  loginHeroDescription: DEFAULT_DESCRIPTION,
  loginHeroFeatures: DEFAULT_FEATURES,
};

function normalizeFeatures(raw: unknown): PublicLoginHeroFeature[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) return null;
  const out: PublicLoginHeroFeature[] = [];
  for (const item of raw) {
    if (out.length >= 3) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const description = typeof o.description === "string" ? o.description.trim() : "";
    if (!title) continue;
    out.push({ title, description });
  }
  return out;
}

/**
 * Safe subset of appSettings for the unauthenticated login / splash surface.
 * Never expose bank, GSTIN, or other sensitive profile fields.
 */
export async function getPublicBranding(): Promise<PublicBranding> {
  const row = await prisma.appJsonRow.findUnique({
    where: { collection_entityId: { collection: "appSettings", entityId: SINGLETON_ENTITY_ID } },
  });
  const raw = (row?.payload ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");

  const heading = str("loginHeroHeading").trim() || DEFAULT_HEADING;
  const description = str("loginHeroDescription").trim() || DEFAULT_DESCRIPTION;
  const featuresParsed = normalizeFeatures(raw.loginHeroFeatures);
  const features =
    featuresParsed === null
      ? DEFAULT_FEATURES
      : featuresParsed; /* [] intentionally hides features */

  return {
    businessName: str("businessName") || DEFAULTS.businessName,
    businessLogo: str("businessLogo"),
    brandPrimary: str("brandPrimary") || DEFAULTS.brandPrimary,
    loginBackgroundImage: str("loginBackgroundImage"),
    loginHeroHeading: heading,
    loginHeroDescription: description,
    loginHeroFeatures: features,
  };
}
