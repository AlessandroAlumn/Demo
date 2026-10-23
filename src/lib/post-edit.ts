// Validation for the post / campaign composer in the backoffice.

export type PostInput = {
  kind: "news" | "campaign";
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
  campaign: string | null;
  goalAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  publishedAt: string;
};

export type PostResult = { ok: true; post: PostInput } | { ok: false; errors: Record<string, string> };

const isIsoDate = (s: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** Validates the composer's fields. Errors are keyed by field so the form can show them next to it. */
export function validatePost(raw: Record<string, string>, today: string): PostResult {
  const get = (k: string) => (raw[k] ?? "").trim();
  const errors: Record<string, string> = {};
  const kind = get("kind") === "campaign" ? "campaign" : "news";

  for (const field of ["titleEs", "titleEn", "bodyEs", "bodyEn"]) {
    if (!get(field)) errors[field] = "required";
  }
  if (get("titleEs").length > 120 || get("titleEn").length > 120) errors.titleEs = "too long (max 120)";

  const publishedAt = get("publishedAt") || today;
  if (!isIsoDate(publishedAt)) errors.publishedAt = "invalid date";

  let campaign: string | null = null;
  let goalAmount: number | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;

  if (kind === "campaign") {
    campaign = get("campaign").toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(campaign)) errors.campaign = "use lowercase letters, numbers and dashes";
    goalAmount = Number(get("goalAmount"));
    if (!get("goalAmount") || !Number.isFinite(goalAmount) || goalAmount <= 0) errors.goalAmount = "must be above 0";
    startDate = get("startDate") || publishedAt;
    endDate = get("endDate");
    if (!isIsoDate(startDate)) errors.startDate = "invalid date";
    if (!isIsoDate(endDate)) errors.endDate = "invalid date";
    else if (isIsoDate(startDate) && endDate < startDate) errors.endDate = "must be after the start";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    post: {
      kind, titleEs: get("titleEs"), titleEn: get("titleEn"), bodyEs: get("bodyEs"), bodyEn: get("bodyEn"),
      campaign, goalAmount, startDate, endDate: kind === "campaign" ? endDate : null, publishedAt,
    },
  };
}
