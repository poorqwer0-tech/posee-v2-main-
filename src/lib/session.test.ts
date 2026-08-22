import { beforeAll, describe, expect, it } from "vitest";
import { createSessionCookie, verifySessionCookie } from "./session";

beforeAll(() => {
  process.env.POS_AUTH_TOKEN = "test-secret-not-a-weak-one";
});

describe("session cookie", () => {
  it("roundtrips a valid session", async () => {
    const cookie = await createSessionCookie(7, "admin");
    const s = await verifySessionCookie(cookie);
    expect(s).toEqual({ staffId: 7, role: "admin" });
  });

  it("rejects a tampered signature", async () => {
    const cookie = await createSessionCookie(7, "admin");
    const tampered = cookie.slice(0, -1) + (cookie.at(-1) === "a" ? "b" : "a");
    expect(await verifySessionCookie(tampered)).toBeNull();
  });

  it("rejects a role escalation (staff→admin) without re-signing", async () => {
    const cookie = await createSessionCookie(7, "staff");
    const forged = cookie.replace(".staff.", ".admin.");
    expect(await verifySessionCookie(forged)).toBeNull();
  });

  it("rejects an expired cookie", async () => {
    // สร้าง payload หมดอายุแล้วเซ็นด้วย secret เดียวกัน
    const { createHmac } = await import("node:crypto");
    const past = Date.now() - 1000;
    const payload = `7.admin.${past}`;
    const sig = createHmac("sha256", process.env.POS_AUTH_TOKEN!).update(payload).digest("hex");
    expect(await verifySessionCookie(`${payload}.${sig}`)).toBeNull();
  });

  it("rejects an old-format (no-exp) cookie", async () => {
    const { createHmac } = await import("node:crypto");
    const payload = "7.admin";
    const sig = createHmac("sha256", process.env.POS_AUTH_TOKEN!).update(payload).digest("hex");
    expect(await verifySessionCookie(`${payload}.${sig}`)).toBeNull();
  });

  it("rejects empty / malformed", async () => {
    expect(await verifySessionCookie(undefined)).toBeNull();
    expect(await verifySessionCookie("garbage")).toBeNull();
  });
});
