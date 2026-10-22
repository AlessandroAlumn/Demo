// The 50 badges (B-*) from BADGES_AND_NOTIFICATIONS.md. Keep IDs identical to that file:
// src/lib/badge-definitions.test.ts fails if they drift apart.
//
// `rule` is the machine-readable form of the human rule in the spec. The badge engine
// (step 7) interprets it; the backoffice edits the numbers.

import type { BadgeCategory, Tier } from "./constants";

export type BadgeRule =
  | { type: "first_donation" }
  | { type: "lifetime_total"; usd: number }
  | { type: "recurring_tier"; tier: "recurring" | "silver" | "gold" | "platinum" | "diamond" }
  | { type: "streak"; months: number }
  | { type: "donor_of_week" }
  | { type: "donor_of_month" }
  | { type: "monthly_top_n"; n: number }
  | { type: "monthly_top_pct"; pct: number }
  | { type: "biggest_climber" }
  | { type: "yearly_top_n"; n: number }
  | { type: "years_donated"; years: number }
  | { type: "anniversary" }
  | { type: "program"; program: string }
  | { type: "full_spectrum"; programs: string[] }
  | { type: "campaign_hero" }
  | { type: "matching_year" }
  | { type: "matching_streak"; years: number }
  | { type: "social_follow"; network: "instagram" | "tiktok" | "x" | "youtube" | "facebook" }
  | { type: "fully_connected" }
  | { type: "shared_first" }
  | { type: "referral"; count: number }
  | { type: "reactivated" }
  | { type: "early_adopter" }
  | { type: "manual" };

export type BadgeSeed = {
  id: string;
  category: BadgeCategory;
  nameEn: string;
  nameEs: string;
  descEn: string;
  descEs: string;
  rule: BadgeRule;
  icon: string;
  tier?: Tier;
  repeatable?: boolean;
  manualOnly?: boolean;
};

const PERMANENT = ["becas", "premio_planchart", "transporte", "infraestructura"];

const club = (
  n: number,
  usd: number,
  label: string,
  tier: Tier,
): BadgeSeed => ({
  id: `B-M${n}`,
  category: "milestone",
  nameEn: `${label} Club`,
  nameEs: `Club de los ${label}`,
  descEn: `Lifetime donations of $${usd.toLocaleString("en-US")} or more.`,
  descEs: `Donaciones acumuladas de $${usd.toLocaleString("en-US")} o más.`,
  rule: { type: "lifetime_total", usd },
  icon: "💰",
  tier,
});

const streak = (n: number, months: number, tier: Tier): BadgeSeed => ({
  id: `B-S${n}`,
  category: "streak",
  nameEn: `${months}-Month Streak`,
  nameEs: `Racha de ${months} Meses`,
  descEn: `${months} consecutive months of successful recurring donations.`,
  descEs: `${months} meses consecutivos de donaciones recurrentes exitosas.`,
  rule: { type: "streak", months },
  icon: "🔥",
  tier,
});

const social = (
  n: number,
  network: "instagram" | "tiktok" | "x" | "youtube" | "facebook",
  nameEn: string,
  nameEs: string,
  handleEn: string,
  handleEs: string,
  icon: string,
): BadgeSeed => ({
  id: `B-SO${n}`,
  category: "social",
  nameEn,
  nameEs,
  descEn: `${handleEn} (confirmed by an admin).`,
  descEs: `${handleEs} (confirmado por un administrador).`,
  rule: { type: "social_follow", network },
  icon,
});

const program = (
  n: number,
  prog: string,
  nameEn: string,
  nameEs: string,
  descEn: string,
  descEs: string,
  icon: string,
): BadgeSeed => ({
  id: `B-P${n}`,
  category: "program",
  nameEn,
  nameEs,
  descEn,
  descEs,
  rule: { type: "program", program: prog },
  icon,
});

export const BADGE_SEEDS: BadgeSeed[] = [
  // 1. Lifetime milestones
  {
    id: "B-M0",
    category: "milestone",
    nameEn: "First Gift",
    nameEs: "Primera Donación",
    descEn: "Your first successful donation to AlumnUSB.",
    descEs: "Tu primera donación exitosa a AlumnUSB.",
    rule: { type: "first_donation" },
    icon: "🎁",
    tier: "bronze",
  },
  club(1, 100, "$100", "bronze"),
  club(2, 250, "$250", "silver"),
  club(3, 500, "$500", "silver"),
  club(4, 1000, "$1K", "gold"),
  club(5, 2500, "$2.5K", "gold"),
  club(6, 5000, "$5K", "platinum"),
  club(7, 10000, "$10K", "diamond"),

  // 2. Recurring tiers
  ...(
    [
      [1, "recurring", "Recurring", "Recurrente", 20, "bronze"],
      [2, "silver", "Silver Recurring", "Recurrente Plata", 50, "silver"],
      [3, "gold", "Gold Recurring", "Recurrente Oro", 100, "gold"],
      [4, "platinum", "Platinum Recurring", "Recurrente Platino", 250, "platinum"],
      [5, "diamond", "Diamond Recurring", "Recurrente Diamante", 500, "diamond"],
    ] as const
  ).map(
    ([n, tier, nameEn, nameEs, usd, color]): BadgeSeed => ({
      id: `B-R${n}`,
      category: "recurring",
      nameEn,
      nameEs,
      descEn: `Active recurring donation of $${usd} or more per month.`,
      descEs: `Donación recurrente activa de $${usd} o más al mes.`,
      rule: { type: "recurring_tier", tier },
      icon: "🔁",
      tier: color,
    }),
  ),

  // 3. Streaks
  streak(1, 3, "bronze"),
  streak(2, 6, "silver"),
  streak(3, 12, "gold"),
  streak(4, 24, "platinum"),

  // 4. Competition (repeatable)
  {
    id: "B-C1",
    category: "competition",
    nameEn: "Donor of the Week",
    nameEs: "Donante de la Semana",
    descEn: "Highest amount donated in a week.",
    descEs: "Mayor monto donado en una semana.",
    rule: { type: "donor_of_week" },
    icon: "🏆",
    tier: "gold",
    repeatable: true,
  },
  {
    id: "B-C2",
    category: "competition",
    nameEn: "Donor of the Month",
    nameEs: "Donante del Mes",
    descEn: "Highest amount donated in a month.",
    descEs: "Mayor monto donado en un mes.",
    rule: { type: "donor_of_month" },
    icon: "👑",
    tier: "platinum",
    repeatable: true,
  },
  {
    id: "B-C3",
    category: "competition",
    nameEn: "Monthly Top 10",
    nameEs: "Top 10 del Mes",
    descEn: "Finished the month in the top 10 of the ranking.",
    descEs: "Terminaste el mes entre los 10 primeros del ranking.",
    rule: { type: "monthly_top_n", n: 10 },
    icon: "🥇",
    tier: "gold",
    repeatable: true,
  },
  {
    id: "B-C4",
    category: "competition",
    nameEn: "Monthly Top 10%",
    nameEs: "Top 10% del Mes",
    descEn: "Finished the month in the top 10% of the ranking.",
    descEs: "Terminaste el mes en el 10% superior del ranking.",
    rule: { type: "monthly_top_pct", pct: 10 },
    icon: "⭐",
    tier: "silver",
    repeatable: true,
  },
  {
    id: "B-C5",
    category: "competition",
    nameEn: "Biggest Climber",
    nameEs: "Mayor Ascenso",
    descEn: "Gained the most positions in the all-time ranking during the month.",
    descEs: "Ganaste más posiciones en el ranking histórico durante el mes.",
    rule: { type: "biggest_climber" },
    icon: "🚀",
    tier: "gold",
    repeatable: true,
  },
  {
    id: "B-C6",
    category: "competition",
    nameEn: "Yearly Top 10",
    nameEs: "Top 10 del Año",
    descEn: "Finished the calendar year in the top 10 of the ranking.",
    descEs: "Terminaste el año calendario entre los 10 primeros del ranking.",
    rule: { type: "yearly_top_n", n: 10 },
    icon: "🏅",
    tier: "diamond",
    repeatable: true,
  },

  // 5. Loyalty
  ...(
    [
      [1, 3, "bronze"],
      [2, 5, "silver"],
      [3, 10, "gold"],
    ] as const
  ).map(
    ([n, years, tier]): BadgeSeed => ({
      id: `B-L${n}`,
      category: "loyalty",
      nameEn: `${years}-Year Supporter`,
      nameEs: `Fiel por ${years} Años`,
      descEn: `Donated in ${years} different calendar years.`,
      descEs: `Donaste en ${years} años calendario distintos.`,
      rule: { type: "years_donated", years },
      icon: "🤝",
      tier,
    }),
  ),
  {
    id: "B-L4",
    category: "loyalty",
    nameEn: "Anniversary",
    nameEs: "Aniversario",
    descEn: "Another year since your first donation.",
    descEs: "Un año más desde tu primera donación.",
    rule: { type: "anniversary" },
    icon: "🎂",
    tier: "silver",
    repeatable: true,
  },

  // 6. Programs & campaigns
  program(1, "becas", "Scholarship Supporter", "Aliado de las Becas", "Donated to student scholarships.", "Donaste a las becas estudiantiles.", "🎓"),
  program(2, "premio_planchart", "Teacher Champion", "Aliado de los Profesores", "Donated to the Enrique Planchart Teaching Award.", "Donaste al Premio Enrique Planchart.", "🍎"),
  program(3, "transporte", "On the Move", "En Ruta", "Donated to the Transportation program.", "Donaste al programa de Transporte.", "🚌"),
  program(4, "infraestructura", "Builder", "Constructor", "Donated to the Infrastructure program.", "Donaste al programa de Infraestructura.", "🏗️"),
  program(5, "fondo_general_emergencia", "First Responder", "Respuesta Rápida", "Donated to the General and Emergency Fund.", "Donaste al Fondo General y de Emergencia.", "🚨"),
  program(6, "concurso_proyectos", "Project Backer", "Impulsor de Proyectos", "Donated to the Project Contest.", "Donaste al Concurso de Proyectos.", "💡"),
  program(7, "eventos", "Event Supporter", "Presente", "Donated through an AlumnUSB event.", "Donaste a través de un evento de AlumnUSB.", "🎟️"),
  {
    id: "B-P8",
    category: "program",
    nameEn: "Full Spectrum",
    nameEs: "Espectro Completo",
    descEn: "Donated to all 4 permanent programs: scholarships, teaching award, transportation and infrastructure.",
    descEs: "Donaste a los 4 programas permanentes: becas, premio docente, transporte e infraestructura.",
    rule: { type: "full_spectrum", programs: PERMANENT },
    icon: "🌈",
    tier: "platinum",
  },
  {
    id: "B-P9",
    category: "program",
    nameEn: "Campaign Hero: {campaign}",
    nameEs: "Héroe de Campaña: {campaign}",
    descEn: "Contributed to a time-limited campaign.",
    descEs: "Contribuiste a una campaña por tiempo limitado.",
    rule: { type: "campaign_hero" },
    icon: "🦸",
    tier: "gold",
    repeatable: true,
  },

  // 7. Matching gifts
  {
    id: "B-G1",
    category: "matching",
    nameEn: "Double Impact {year}",
    nameEs: "Doble Impacto {year}",
    descEn: "Your employer matched a gift this year.",
    descEs: "Tu empleador igualó una donación este año.",
    rule: { type: "matching_year" },
    icon: "✌️",
    tier: "gold",
    repeatable: true,
  },
  {
    id: "B-G2",
    category: "matching",
    nameEn: "Matching Streak",
    nameEs: "Racha de Doble Impacto",
    descEn: "Employer-matched gifts in 3 different years.",
    descEs: "Donaciones igualadas por tu empleador en 3 años distintos.",
    rule: { type: "matching_streak", years: 3 },
    icon: "🔗",
    tier: "platinum",
  },

  // 8. Social & community
  social(1, "instagram", "Instagram Follower", "Seguidor en Instagram", "Follows @alumn_usb on Instagram", "Sigues a @alumn_usb en Instagram", "📸"),
  social(2, "tiktok", "TikTok Follower", "Seguidor en TikTok", "Follows @alumn_usb on TikTok", "Sigues a @alumn_usb en TikTok", "🎵"),
  social(3, "x", "X Follower", "Seguidor en X", "Follows @Alumn_USB on X", "Sigues a @Alumn_USB en X", "𝕏"),
  social(4, "youtube", "YouTube Subscriber", "Suscriptor en YouTube", "Subscribed to AlumnUSB on YouTube", "Suscrito a AlumnUSB en YouTube", "▶️"),
  social(5, "facebook", "Facebook Follower", "Seguidor en Facebook", "Follows alumnusb on Facebook", "Sigues a alumnusb en Facebook", "👍"),
  {
    id: "B-SO6",
    category: "social",
    nameEn: "Fully Connected",
    nameEs: "Totalmente Conectado",
    descEn: "Follows AlumnUSB on every social network.",
    descEs: "Sigues a AlumnUSB en todas las redes sociales.",
    rule: { type: "fully_connected" },
    icon: "🌐",
    tier: "gold",
  },
  {
    id: "B-SO7",
    category: "social",
    nameEn: "Proud Supporter",
    nameEs: "Orgulloso de Apoyar",
    descEn: "Shared a badge on social media for the first time.",
    descEs: "Compartiste una insignia en redes sociales por primera vez.",
    rule: { type: "shared_first" },
    icon: "📣",
    tier: "bronze",
  },
  {
    id: "B-SO8",
    category: "social",
    nameEn: "Ambassador",
    nameEs: "Embajador",
    descEn: "An AlumnUSB local ambassador. Awarded by the team.",
    descEs: "Embajador local de AlumnUSB. Otorgada por el equipo.",
    rule: { type: "manual" },
    icon: "🎖️",
    tier: "diamond",
    manualOnly: true,
  },
  {
    id: "B-SO9",
    category: "social",
    nameEn: "Recruiter",
    nameEs: "Reclutador",
    descEn: "A friend you referred made a donation.",
    descEs: "Un amigo que referiste hizo una donación.",
    rule: { type: "referral", count: 1 },
    icon: "🧲",
    tier: "silver",
  },
  {
    id: "B-SO10",
    category: "social",
    nameEn: "Super Recruiter",
    nameEs: "Súper Reclutador",
    descEn: "5 friends you referred have donated.",
    descEs: "5 amigos que referiste han donado.",
    rule: { type: "referral", count: 5 },
    icon: "🧲",
    tier: "gold",
  },

  // 9. Special
  {
    id: "B-X1",
    category: "special",
    nameEn: "Back in the Game",
    nameEs: "De Vuelta en el Juego",
    descEn: "Reactivated a failed or cancelled recurring donation.",
    descEs: "Reactivaste una donación recurrente fallida o cancelada.",
    rule: { type: "reactivated" },
    icon: "💪",
    tier: "silver",
  },
  {
    id: "B-X2",
    category: "special",
    nameEn: "Early Adopter",
    nameEs: "Pionero",
    descEn: "Joined the platform in its first month.",
    descEs: "Te uniste a la plataforma en su primer mes.",
    rule: { type: "early_adopter" },
    icon: "🌱",
    tier: "bronze",
  },
];
