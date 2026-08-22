import { describe, expect, it } from "vitest";
import { isTerminalStatus, validateStatusChange } from "./order-ops";

describe("validateStatusChange (#4 guard)", () => {
  it("allows a normal forward move", () => {
    expect(validateStatusChange("new", "ready").ok).toBe(true);
  });

  it("rejects an unknown status", () => {
    const r = validateStatusChange("new", "hacked");
    expect(r.ok).toBe(false);
  });

  it("rejects changing out of a terminal state", () => {
    expect(validateStatusChange("paid", "ready").ok).toBe(false);
    expect(validateStatusChange("cancelled", "new").ok).toBe(false);
  });

  it("allows an idempotent set on a terminal state", () => {
    expect(validateStatusChange("paid", "paid").ok).toBe(true);
  });
});

describe("isTerminalStatus", () => {
  it("knows terminal vs open states", () => {
    expect(isTerminalStatus("paid")).toBe(true);
    expect(isTerminalStatus("cancelled")).toBe(true);
    expect(isTerminalStatus("new")).toBe(false);
    expect(isTerminalStatus("ready")).toBe(false);
  });
});
