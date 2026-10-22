// Bilingual demo content for the feed (admin posts and one campaign). Seeded idempotently by title.
// The campaign goal is tuned to the mock data (about $9,000 raised by the end of November) so the
// 50% and 75% progress notifications and the "ending soon" reminder all appear in the demo.

import type { PrismaClient } from "@prisma/client";

export type DemoPost = {
  kind: "news" | "campaign";
  titleEs: string;
  titleEn: string;
  bodyEs: string;
  bodyEn: string;
  campaign?: string;
  goalAmount?: number;
  startDate?: string;
  endDate?: string;
  publishedAt: string;
};

export const DEMO_POSTS: DemoPost[] = [
  {
    kind: "news",
    publishedAt: "2026-07-02",
    titleEs: "Bienvenido a tu panel de impacto",
    titleEn: "Welcome to your impact dashboard",
    bodyEs:
      "Aquí verás cuánto has donado, tu posición en los rankings y las insignias que vas ganando. Tu posición es privada: solo tú la ves.",
    bodyEn:
      "Here you can see how much you have donated, your position in the rankings and the badges you earn. Your position is private: only you can see it.",
  },
  {
    kind: "campaign",
    publishedAt: "2026-08-01",
    campaign: "emergencia-sismo-2026",
    goalAmount: 9500,
    startDate: "2026-08-01",
    endDate: "2026-12-31",
    titleEs: "Ayuda para los afectados por el sismo",
    titleEn: "Earthquake relief",
    bodyEs:
      "La comunidad USB fue afectada por el sismo. Todo lo recaudado en esta campaña irá al Fondo General y de Emergencia. ¡Ayúdanos a llegar a la meta antes de fin de año!",
    bodyEn:
      "The USB community was hit by the earthquake. Everything raised in this campaign goes to the General and Emergency Fund. Help us reach the goal before the end of the year!",
  },
  {
    kind: "news",
    publishedAt: "2026-09-15",
    titleEs: "Duplica tu donación con tu empresa",
    titleEn: "Double your donation with your employer",
    bodyEs:
      "Muchas empresas igualan las donaciones de sus empleados. Busca la tuya en la sección Matching y gana la insignia Doble Impacto.",
    bodyEn:
      "Many companies match their employees' donations. Look yours up in the Matching section and earn the Double Impact badge.",
  },
  {
    kind: "news",
    publishedAt: "2026-11-03",
    titleEs: "Gracias por un gran año",
    titleEn: "Thank you for a great year",
    bodyEs:
      "Gracias a donantes como tú seguimos otorgando becas y premios a profesores. Pronto cerramos el año: revisa tu posición y tus insignias.",
    bodyEn:
      "Thanks to donors like you we keep awarding scholarships and teaching prizes. The year closes soon: check your rank and your badges.",
  },
];

export async function seedDemoPosts(db: PrismaClient): Promise<number> {
  let created = 0;
  for (const post of DEMO_POSTS) {
    const existing = await db.post.findFirst({ where: { titleEn: post.titleEn } });
    if (existing) continue;
    await db.post.create({
      data: {
        kind: post.kind,
        titleEs: post.titleEs,
        titleEn: post.titleEn,
        bodyEs: post.bodyEs,
        bodyEn: post.bodyEn,
        campaign: post.campaign ?? null,
        goalAmount: post.goalAmount ?? null,
        startDate: post.startDate ?? null,
        endDate: post.endDate ?? null,
        publishedAt: post.publishedAt,
      },
    });
    created++;
  }
  return created;
}
