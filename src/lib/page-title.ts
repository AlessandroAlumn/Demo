import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** `export const generateMetadata = ({ params }) => titleFor(params, "Header", "badges")` gives a page its tab title. */
export async function titleFor(
  params: Promise<{ locale: string }>,
  namespace: string,
  key: string,
): Promise<Metadata> {
  const { locale } = await params;
  const t = (await getTranslations({ locale, namespace })) as unknown as (k: string) => string;
  return { title: t(key) };
}
