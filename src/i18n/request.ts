import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    // Fixed zone: the simulated "today" is a plain date, never shifted by the host's timezone.
    timeZone: "UTC",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
