import { describe, expect, it } from "vitest";
import { categoriesFromProducts, categoryEmoji } from "./utils";

describe("categoriesFromProducts (white-label categories)", () => {
  it("orders suggested categories first, then custom, deduped", () => {
    const out = categoriesFromProducts([
      { category: "คาเฟ่" },
      { category: "เบเกอรี่" },
      { category: "ก๋วยเตี๋ยว" },
      { category: "คาเฟ่" }, // ซ้ำ
    ]);
    expect(out.map((c) => c.key)).toEqual(["ก๋วยเตี๋ยว", "คาเฟ่", "เบเกอรี่"]);
  });

  it("attaches known emoji, falls back for custom", () => {
    const out = categoriesFromProducts([{ category: "ก๋วยเตี๋ยว" }, { category: "เบเกอรี่" }]);
    expect(out.find((c) => c.key === "ก๋วยเตี๋ยว")!.emoji).toBe("🍜");
    expect(out.find((c) => c.key === "เบเกอรี่")!.emoji).toBe("🍽️");
  });

  it("ignores empty categories", () => {
    expect(categoriesFromProducts([{ category: "" }])).toEqual([]);
  });
});

describe("categoryEmoji", () => {
  it("known → specific, unknown → default", () => {
    expect(categoryEmoji("คาเฟ่")).toBe("☕");
    expect(categoryEmoji("อะไรก็ไม่รู้")).toBe("🍽️");
  });
});
