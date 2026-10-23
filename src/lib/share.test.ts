import { describe, expect, it } from "vitest";
import { ALIAS_MAX_LENGTH, normalizeAlias, referralLink, shareLinks } from "./share";

describe("referralLink", () => {
  it("adds the donor's code to the donate page", () => {
    expect(referralLink("USER14")).toBe("https://alumnusb.org/dona?ref=USER14");
    expect(referralLink("a b&c")).toBe("https://alumnusb.org/dona?ref=a%20b%26c");
  });
  it("is the plain donate page without a code", () => {
    expect(referralLink(null)).toBe("https://alumnusb.org/dona");
    expect(referralLink("")).toBe("https://alumnusb.org/dona");
  });
});

describe("shareLinks", () => {
  const text = "I just earned Gold Recurring 🎓 Donate here →";
  const url = "https://alumnusb.org/dona?ref=USER3";
  const links = shareLinks(text, url);

  it("puts the message and the link in the WhatsApp text", () => {
    expect(links.whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(links.whatsapp.split("text=")[1])).toBe(`${text} ${url}`);
  });

  it("gives X the text and the link separately", () => {
    const u = new URL(links.x);
    expect(u.hostname).toBe("twitter.com");
    expect(u.searchParams.get("text")).toBe(text);
    expect(u.searchParams.get("url")).toBe(url);
  });

  it("shares the link on Facebook and LinkedIn", () => {
    expect(new URL(links.facebook).searchParams.get("u")).toBe(url);
    expect(new URL(links.linkedin).searchParams.get("url")).toBe(url);
  });

  it("has no Instagram web link (the story image is downloaded instead)", () => {
    expect(Object.keys(links).sort()).toEqual(["facebook", "linkedin", "whatsapp", "x"]);
  });
});

describe("normalizeAlias", () => {
  it("trims, collapses spaces and strips angle brackets", () => {
    expect(normalizeAlias("  Class   of '98 ")).toBe("Class of '98");
    expect(normalizeAlias("<b>Ana</b>")).toBe("bAna/b");
  });
  it("caps the length and returns null for nothing", () => {
    expect(normalizeAlias("x".repeat(80))).toHaveLength(ALIAS_MAX_LENGTH);
    expect(normalizeAlias("   ")).toBeNull();
    expect(normalizeAlias("<>")).toBeNull();
  });
});
