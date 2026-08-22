import { describe, expect, it } from "vitest";
import { primaryOverride } from "./theme";

describe("primaryOverride", () => {
  it("returns null for empty / invalid input (= ใช้ธีมเดิม)", () => {
    expect(primaryOverride("")).toBeNull();
    expect(primaryOverride(null)).toBeNull();
    expect(primaryOverride("xyz")).toBeNull();
    expect(primaryOverride("#12345")).toBeNull(); // 5 หลัก
  });

  it("maps a hex to the primary token family + logo gradient", () => {
    const v = primaryOverride("#2e7dd2")!;
    expect(v["--brand-primary"]).toBe("46 125 210");
    expect(v["--c-primary"]).toBe("#2e7dd2");
    expect(v["--c-logo-grad"]).toContain("linear-gradient");
    expect(v["--c-primary-dark"]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("accepts hex without leading #", () => {
    expect(primaryOverride("2e7dd2")!["--c-primary"]).toBe("#2e7dd2");
  });

  it("derives a darker shade for the pressed/shadow token", () => {
    const v = primaryOverride("#ffffff")!;
    // ขาว → เฉดเข้ม (×0.6) ต้องเข้มกว่า
    expect(v["--c-primary-dark"]).not.toBe("#ffffff");
  });
});
