import { afterEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import {
  effectiveStaffAccess,
  isLanRequest,
  publicOrigin,
  requestIsHttps,
  safeNextPath,
} from "./request-origin";

function req(headers: Record<string, string>): NextRequest {
  return {
    headers: new Headers(headers),
    nextUrl: { protocol: "http:", origin: "http://host" },
  } as unknown as NextRequest;
}

describe("safeNextPath (H3 open-redirect guard)", () => {
  it("accepts same-site paths", () => {
    expect(safeNextPath("/staff")).toBe("/staff");
    expect(safeNextPath("/orders?x=1")).toBe("/orders?x=1");
  });
  it("rejects off-site / protocol-relative / scheme", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("/a\\b")).toBe("/");
    expect(safeNextPath("evil.com")).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});

describe("effectiveStaffAccess (M7)", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env.POS_STAFF_ACCESS = saved.POS_STAFF_ACCESS;
    process.env.VERCEL = saved.VERCEL;
  });

  it("env override wins on any platform", () => {
    process.env.POS_STAFF_ACCESS = "public";
    process.env.VERCEL = "";
    expect(effectiveStaffAccess("lan-only")).toBe("public");
  });
  it("forces public on Vercel (no LAN → กันล็อกตัวเอง)", () => {
    delete process.env.POS_STAFF_ACCESS;
    process.env.VERCEL = "1";
    expect(effectiveStaffAccess("lan-only")).toBe("public");
  });
  it("otherwise uses the DB value (lan-only default)", () => {
    delete process.env.POS_STAFF_ACCESS;
    delete process.env.VERCEL;
    expect(effectiveStaffAccess("public")).toBe("public");
    expect(effectiveStaffAccess("lan-only")).toBe("lan-only");
    expect(effectiveStaffAccess(undefined)).toBe("lan-only");
  });
});

describe("isLanRequest (fail-closed)", () => {
  it("true only for a real LAN request", () => {
    expect(isLanRequest(req({ host: "192.168.1.9:3000", "x-forwarded-for": "192.168.1.50" }))).toBe(true);
  });
  it("false when a tailscale-* header is present (funnel)", () => {
    expect(isLanRequest(req({ host: "192.168.1.9", "x-forwarded-for": "192.168.1.50", "tailscale-user-login": "a@b.c" }))).toBe(false);
  });
  it("false for a *.ts.net host", () => {
    expect(isLanRequest(req({ host: "shop.tailXYZ.ts.net", "x-forwarded-for": "100.64.0.1" }))).toBe(false);
  });
  it("false for a public x-forwarded-for", () => {
    expect(isLanRequest(req({ host: "192.168.1.9", "x-forwarded-for": "8.8.8.8" }))).toBe(false);
  });
  it("false (fail-closed) when x-forwarded-for is missing", () => {
    expect(isLanRequest(req({ host: "192.168.1.9" }))).toBe(false);
  });
});

describe("publicOrigin / requestIsHttps", () => {
  it("builds origin from forwarded headers, not request.url", () => {
    expect(publicOrigin(req({ "x-forwarded-host": "shop.ts.net", "x-forwarded-proto": "https" }))).toBe("https://shop.ts.net");
  });
  it("detects https from x-forwarded-proto", () => {
    expect(requestIsHttps(req({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(requestIsHttps(req({ "x-forwarded-proto": "http" }))).toBe(false);
  });
});
