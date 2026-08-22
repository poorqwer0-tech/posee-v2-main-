import { describe, expect, it } from "vitest";
import { getMenuOptionGroups, maxOptionSurcharge, priceBand } from "./menu-options";

const noodle = { category: "ก๋วยเตี๋ยว", name: "ก๋วยเตี๋ยวหมู", options: null, price: 160 };

describe("priceBand (C2 guard)", () => {
  it("computes max surcharge from category default option groups", () => {
    // NOODLE: extra ไข่ 15 (max1) + size พิเศษ25/จัมโบ้50 (max1 → 50) = 65
    expect(maxOptionSurcharge(getMenuOptionGroups(noodle))).toBe(65);
  });

  it("band = [base, base + maxSurcharge]", () => {
    expect(priceBand(noodle)).toEqual({ min: 160, max: 225 });
  });

  it("respects per-menu custom options JSON", () => {
    const custom = {
      category: "อื่นๆ",
      name: "x",
      price: 50,
      options: JSON.stringify([{ title: "topping", min: 0, max: 2, options: [{ label: "a", price: 10 }, { label: "b", price: 20 }] }]),
    };
    // max = 2 ตัวแพงสุด = 20 + 10 = 30
    expect(priceBand(custom)).toEqual({ min: 50, max: 80 });
  });

  it("no options → band is just the base price", () => {
    const plain = { category: "อื่นๆ", name: "y", price: 40, options: "[]" };
    expect(priceBand(plain)).toEqual({ min: 40, max: 40 });
  });
});
