import { describe, expect, it } from "vitest";
import { normalizeDomain, templateForSoftware } from "./resolve-instance-domain";

describe("normalizeDomain", () => {
  it("accepts a bare domain", () => {
    expect(normalizeDomain("mastodon.social")).toBe("mastodon.social");
  });

  it("extracts the domain from a @user@domain handle", () => {
    expect(normalizeDomain("@alice@misskey.io")).toBe("misskey.io");
    expect(normalizeDomain("bob@pleroma.example.org")).toBe(
      "pleroma.example.org",
    );
  });

  it("strips protocol, path and port", () => {
    expect(normalizeDomain("https://Mastodon.Social/about")).toBe(
      "mastodon.social",
    );
    expect(normalizeDomain("mastodon.social:443")).toBe("mastodon.social");
  });

  it("rejects loopback and internal-only names (SSRF guard)", () => {
    expect(normalizeDomain("localhost")).toBeNull();
    expect(normalizeDomain("router.local")).toBeNull();
    expect(normalizeDomain("svc.internal")).toBeNull();
    expect(normalizeDomain("127.0.0.1")).toBeNull();
    expect(normalizeDomain("192.168.1.1")).toBeNull();
  });

  it("rejects empty or malformed input", () => {
    expect(normalizeDomain("")).toBeNull();
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("nodot")).toBeNull();
  });
});

describe("templateForSoftware", () => {
  it("maps known software to its interaction URL pattern", () => {
    expect(templateForSoftware("mastodon")).toContain("authorize_interaction");
    expect(templateForSoftware("Misskey")).toContain("authorize-follow");
    expect(templateForSoftware("akkoma")).toContain("ostatus_subscribe");
  });

  it("falls back to the Mastodon pattern for unknown or missing software", () => {
    expect(templateForSoftware(null)).toContain("authorize_interaction");
    expect(templateForSoftware("somenewthing")).toContain(
      "authorize_interaction",
    );
  });
});
