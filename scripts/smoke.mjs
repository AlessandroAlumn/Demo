// Smoke test against a RUNNING server (npm run dev): signs in the way a browser without JavaScript would
// (replaying the login form) and checks that each page answers 200 and contains what it should, in both
// languages. Not part of `npm test`: it needs the dev server and a demo date with some activity.
//
//   node scripts/smoke.mjs [baseUrl] [username]      default: http://localhost:3000 User3

const base = process.argv[2] ?? "http://localhost:3000";
const username = process.argv[3] ?? "User3";

let failures = 0;
const check = (ok, label, extra = "") => {
  console.log(`${ok ? "  ok " : "FAIL "} ${label}${ok ? "" : extra ? ` -> ${extra}` : ""}`);
  if (!ok) failures++;
};

async function login(locale) {
  const html = await (await fetch(`${base}/${locale}/login`)).text();
  const form = new FormData();
  for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/g)) {
    const name = /name="([^"]*)"/.exec(m[0])?.[1];
    const value = (/value="([^"]*)"/.exec(m[0])?.[1] ?? "").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
    if (name) form.append(name, name === "locale" ? locale : value);
  }
  form.append("username", username);
  form.append("password", "ignored");
  const res = await fetch(`${base}/${locale}/login`, { method: "POST", body: form, redirect: "manual" });
  const cookie = res.headers.getSetCookie().find((c) => c.startsWith("alumnusb_session="));
  if (!cookie) throw new Error(`login failed for ${username} (${res.status})`);
  return cookie.split(";")[0];
}

async function page(cookie, path) {
  const res = await fetch(`${base}${path}`, { headers: { Cookie: cookie }, redirect: "manual" });
  const text = res.status === 200 ? await res.text() : "";
  return { status: res.status, text, location: res.headers.get("location") };
}

const strip = (html) => html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

for (const locale of ["es", "en"]) {
  console.log(`\n== ${username} / ${locale} ==`);
  const cookie = await login(locale);
  const words =
    locale === "es"
      ? { hello: `Hola, ${username}`, donations: "Mis donaciones", badges: "insignias ganadas", feed: "Actividad", alertWord: "no se está procesando" }
      : { hello: `Hello, ${username}`, donations: "My donations", badges: "badges earned", feed: "Activity", alertWord: "isn't going through" };

  const dash = await page(cookie, `/${locale}/dashboard`);
  check(dash.status === 200, "dashboard answers 200", String(dash.status));
  const dashText = strip(dash.text);
  check(dashText.includes(words.hello), `dashboard greets "${words.hello}"`);
  check(/#\d/.test(dashText), "dashboard shows a rank like #52");
  check(dashText.includes("🔔") || dash.text.includes("aria-label"), "header has the bell");
  check(dash.text.includes("role=\"alert\"") === dashText.includes(words.alertWord), "payment banner matches its message");

  const donations = await page(cookie, `/${locale}/donations`);
  check(donations.status === 200 && strip(donations.text).includes(words.donations), "donations page", String(donations.status));

  const badges = await page(cookie, `/${locale}/badges`);
  check(badges.status === 200 && strip(badges.text).includes(words.badges), "badges page", String(badges.status));

  const detail = await page(cookie, `/${locale}/badges/B-M0`);
  const firstGift = locale === "es" ? "Primera Donación" : "First Gift";
  check(detail.status === 200 && strip(detail.text).includes(firstGift), `badge detail page shows "${firstGift}"`, String(detail.status));
  const missing = await page(cookie, `/${locale}/badges/B-NOPE`);
  check(missing.status === 404, "unknown badge is a 404", String(missing.status));

  const feed = await page(cookie, `/${locale}/feed`);
  check(feed.status === 200 && strip(feed.text).includes(words.feed), "feed page", String(feed.status));

  const matching = await page(cookie, `/${locale}/matching`);
  const matchingTitle = locale === "es" ? "¿Tu empresa iguala donaciones?" : "Does your company match?";
  check(matching.status === 200 && strip(matching.text).includes(matchingTitle), "matching page", String(matching.status));

  const profile = await page(cookie, `/${locale}/profile`);
  check(profile.status === 200 && strip(profile.text).includes(locale === "es" ? "Mi perfil" : "My profile"), "profile page", String(profile.status));
  check(strip(profile.text).includes("https://alumnusb.org/dona?ref="), "profile shows the referral link");

  const share = await page(cookie, `/${locale}/share/B-M0?period=`);
  check(share.status === 200 && strip(share.text).includes(locale === "es" ? "Comparte tu insignia" : "Share your badge"), "share page for an earned badge", String(share.status));
  const unearned = await page(cookie, `/${locale}/share/B-C2`);
  check(unearned.status === 200 && !unearned.text.includes("/api/share-card/"), "an unearned badge shows no card");

  const card = await fetch(`${base}/api/share-card/B-M0?locale=${locale}&format=card&period=`, { headers: { Cookie: cookie } });
  const bytes = new Uint8Array(await card.arrayBuffer());
  const dims = bytes.length > 24 ? new DataView(bytes.buffer).getUint32(16) + "x" + new DataView(bytes.buffer).getUint32(20) : "";
  check(card.status === 200 && card.headers.get("content-type") === "image/png" && dims === "1200x630", "share card is a 1200x630 PNG", `${card.status} ${dims}`);
  const cardAnon = await fetch(`${base}/api/share-card/B-M0`);
  check(cardAnon.status === 401, "the card API needs a signed-in user", String(cardAnon.status));
  const cardOther = await fetch(`${base}/api/share-card/B-C2?locale=${locale}`, { headers: { Cookie: cookie } });
  check(cardOther.status === 404, "the card API refuses a badge you have not earned", String(cardOther.status));

  const admin = await page(cookie, `/${locale}/admin`);
  check(admin.status === 307 && (admin.location ?? "").endsWith(`/${locale}/dashboard`), "a donor is kept out of /admin", `${admin.status} ${admin.location}`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll checks passed");
process.exitCode = failures ? 1 : 0;
