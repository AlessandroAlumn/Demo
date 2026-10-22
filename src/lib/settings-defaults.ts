// Default values for the admin-editable Setting rows (PLAN.md section 6 and
// BADGES_AND_NOTIFICATIONS.md "Impact Points"). The seed inserts only the keys that are missing.

export type AppSettings = {
  launchDate: string;
  simulatedToday: string;
  /** "" until the first (baseline) day has been processed. */
  lastProcessedDate: string;
  points: {
    oneTimePerDollar: number;
    recurringPerDollar: number;
    matchingPerDollar: number;
    streakBonusPerMonth: number;
    streakBonusMaxPerMonth: number;
    engagementPerAction: number;
    engagementMaxPerMonth: number;
  };
  recurringTiers: { recurring: number; silver: number; gold: number; platinum: number; diamond: number };
  graceDays: number;
  failureWindowDaysMonthly: number;
  failureWindowDaysAnnual: number;
  gapNudgeThresholdUsd: number;
  gapNudgeCooldownDays: number;
  /** Minimum days between "someone passed you" notifications per ranking (0 = every move). */
  rankDownCooldownDays: number;
  nextMilestoneNudgePct: number;
  lapsedMonths: number;
  matchingReminderMonthDay: string;
  earlyAdopterDays: number;
  /** Organisation-wide totals (USD) that trigger the "together we passed $X" notification (N30). */
  orgMilestones: number[];
  impactEquivalences: { usd: number; key: string }[];
};

export const SETTING_DEFAULTS: AppSettings = {
  /** Demo clock. The engine never reads the real clock. */
  launchDate: "2026-07-01",
  simulatedToday: "2026-07-01",
  lastProcessedDate: "",

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
  rankDownCooldownDays: 7,
  nextMilestoneNudgePct: 10,
  lapsedMonths: 6,
  matchingReminderMonthDay: "09-01",
  earlyAdopterDays: 30,

  /** Tuned to the 500-donor mock data (about $180K at launch, $231K by the end of December). */
  orgMilestones: [150_000, 200_000, 225_000, 250_000],

  /** Placeholder impact equivalences, shown as "≈" lines. The UI marks them as placeholders. */
  impactEquivalences: [
    { usd: 300, key: "scholarshipMonth" },
    { usd: 150, key: "teacherAwardShare" },
    { usd: 50, key: "transportWeek" },
  ],
};

export type SettingKey = keyof AppSettings;
