// Allowed values for the enum-like string columns in the database and CSVs.

export const PAYMENT_METHODS = [
  "card",
  "paypal",
  "zelle",
  "check",
  "crypto",
  "matching_gift",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** The 4 permanent programs first, then special campaigns / other programs. */
export const PERMANENT_PROGRAMS = [
  "becas",
  "premio_planchart",
  "transporte",
  "infraestructura",
] as const;

export const PROGRAMS = [
  ...PERMANENT_PROGRAMS,
  "fondo_general_emergencia",
  "concurso_proyectos",
  "eventos",
] as const;
export type Program = (typeof PROGRAMS)[number];

export const DONATION_STATUSES = ["succeeded", "failed"] as const;
export type DonationStatus = (typeof DONATION_STATUSES)[number];

export const FREQUENCIES = ["monthly", "annual"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const SUBSCRIPTION_STATUSES = ["active", "failed", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const ROLES = ["donor", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const RANKINGS = ["monthly", "yearly", "alltime"] as const;
export type Ranking = (typeof RANKINGS)[number];

export const SOCIAL_NETWORKS = [
  "instagram",
  "tiktok",
  "x",
  "youtube",
  "facebook",
] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SHARE_NETWORKS = [
  "whatsapp",
  "x",
  "facebook",
  "linkedin",
  "instagram",
] as const;
export type ShareNetwork = (typeof SHARE_NETWORKS)[number];

export const CLAIM_STATUSES = ["pending", "approved", "rejected"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const BADGE_CATEGORIES = [
  "milestone",
  "recurring",
  "streak",
  "competition",
  "loyalty",
  "program",
  "matching",
  "social",
  "special",
] as const;
export type BadgeCategory = (typeof BADGE_CATEGORIES)[number];

export const TIERS = ["bronze", "silver", "gold", "platinum", "diamond"] as const;
export type Tier = (typeof TIERS)[number];

/** Public social profiles, used by the profile page "Follow" links. */
export const SOCIAL_URLS: Record<SocialNetwork, string> = {
  instagram: "https://www.instagram.com/alumn_usb",
  tiktok: "https://www.tiktok.com/@alumn_usb",
  x: "https://x.com/Alumn_USB",
  youtube: "https://www.youtube.com/@AlumnUSB",
  facebook: "https://www.facebook.com/alumnusb",
};
