// Default values for the admin-editable Setting rows (PLAN.md section 6 and
// BADGES_AND_NOTIFICATIONS.md "Impact Points"). The seed inserts only the keys that are missing.

export const SETTING_DEFAULTS = {
  /** Demo clock. The engine never reads the real clock. */
  launchDate: "2026-07-01",
  simulatedToday: "2026-07-01",
  lastProcessedDate: "2026-07-01",

  /** Impact Points weights. */
  points: {
    oneTimePerDollar: 1,
    recurringPerDollar: 1.5,
    matchingPerDollar: 1,
    streakBonusPerMonth: 5,
    streakBonusMaxPerMonth: 60,
    engagementPerAction: 5,
    engagementMaxPerMonth: 20,
  },

  /** Minimum current monthly recurring amount (USD) for each tier. */
  recurringTiers: {
    recurring: 20,
    silver: 50,
    gold: 100,
    platinum: 250,
    diamond: 500,
  },

  /** Subscription health. */
  graceDays: 7,
  failureWindowDaysMonthly: 35,
  failureWindowDaysAnnual: 370,

  /** Notification tuning. */
  gapNudgeThresholdUsd: 20,
  gapNudgeCooldownDays: 7,
  nextMilestoneNudgePct: 10,
  lapsedMonths: 6,
  matchingReminderMonthDay: "09-01",
  earlyAdopterDays: 30,

  /** Placeholder impact equivalences, shown as "≈" lines. The UI marks them as placeholders. */
  impactEquivalences: [
    { usd: 300, key: "scholarshipMonth" },
    { usd: 150, key: "teacherAwardShare" },
    { usd: 50, key: "transportWeek" },
  ],
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
