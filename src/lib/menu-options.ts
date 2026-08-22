export type MenuOption = {
  label: string;
  price: number;
};

export type MenuOptionGroup = {
  key: string;
  title: string;
  helper: string;
  min: number;
  max: number;
  options: MenuOption[];
};

const NOODLE_GROUPS: MenuOptionGroup[] = [
  {
    key: "extra",
    title: "เพิ่มเติม",
    helper: "เลือกได้มากสุด 1 รายการ",
    min: 0,
    max: 1,
    options: [{ label: "ไข่ยางมะตูม", price: 15 }],
  },
  {
    key: "noodle",
    title: "เส้น",
    helper: "เลือกอย่างน้อย 1 รายการ",
    min: 1,
    max: 1,
    options: [
      { label: "เส้นเล็ก", price: 0 },
      { label: "เส้นใหญ่", price: 0 },
      { label: "บะหมี่", price: 0 },
      { label: "เส้นหมี่", price: 0 },
      { label: "วุ้นเส้น", price: 0 },
      { label: "ไวไว", price: 0 },
      { label: "เกี้ยมอี๋", price: 0 },
    ],
  },
  {
    key: "soup",
    title: "ตัวเลือก",
    helper: "เลือกอย่างน้อย 1 รายการ",
    min: 1,
    max: 1,
    options: [
      { label: "น้ำ", price: 0 },
      { label: "แห้ง", price: 0 },
    ],
  },
  {
    key: "protein",
    title: "ประเภทอาหาร",
    helper: "เลือกอย่างน้อย 1 รายการ",
    min: 1,
    max: 1,
    options: [
      { label: "ลูกชิ้นหมู+หมูเด้งนครปฐม", price: 0 },
      { label: "ลูกชิ้นปลาเยาวราช", price: 0 },
      { label: "รวมหมู กะ ปลา", price: 0 },
    ],
  },
  {
    key: "size",
    title: "ขนาด",
    helper: "เลือกอย่างน้อย 1 รายการ",
    min: 1,
    max: 1,
    options: [
      { label: "ธรรมดา", price: 0 },
      { label: "พิเศษ", price: 25 },
      { label: "จัมโบ้", price: 50 },
    ],
  },
  {
    key: "takeaway",
    title: "กลับบ้าน",
    helper: "เลือกได้มากสุด 1 รายการ",
    min: 0,
    max: 1,
    options: [{ label: "กลับบ้าน", price: 0 }],
  },
];

const RICE_GROUPS: MenuOptionGroup[] = [
  {
    key: "extra",
    title: "เพิ่มเติม",
    helper: "เลือกได้มากสุด 1 รายการ",
    min: 0,
    max: 1,
    options: [{ label: "ไข่ยางมะตูม", price: 15 }],
  },
  {
    key: "size",
    title: "ขนาด",
    helper: "เลือกอย่างน้อย 1 รายการ",
    min: 1,
    max: 1,
    options: [
      { label: "ธรรมดา", price: 0 },
      { label: "พิเศษ", price: 25 },
      { label: "จัมโบ้", price: 50 },
    ],
  },
  {
    key: "takeaway",
    title: "กลับบ้าน",
    helper: "เลือกได้มากสุด 1 รายการ",
    min: 0,
    max: 1,
    options: [{ label: "กลับบ้าน", price: 0 }],
  },
];

const CAFE_GROUPS: MenuOptionGroup[] = [
  {
    key: "temperature",
    title: "เมนูร้อน-เย็น",
    helper: "เลือกอย่างน้อย 1 รายการ",
    min: 1,
    max: 1,
    options: [
      { label: "ร้อน hot", price: 0 },
      { label: "เย็นสดชื่น cool", price: 0 },
    ],
  },
  {
    key: "sweetness",
    title: "ระดับความหวาน",
    helper: "เลือกอย่างน้อย 1 รายการ",
    min: 1,
    max: 1,
    options: [
      { label: "No sugar", price: 0 },
      { label: "ความหวาน25%", price: 0 },
      { label: "ความหวาน50%", price: 0 },
      { label: "ความหวาน75%", price: 0 },
      { label: "ความหวาน100%", price: 0 },
      { label: "หวานสุดๆๆๆ", price: 0 },
    ],
  },
  {
    key: "takeaway",
    title: "กลับบ้าน",
    helper: "เลือกได้มากสุด 1 รายการ",
    min: 0,
    max: 1,
    options: [{ label: "กลับบ้าน", price: 0 }],
  },
];

const SIMPLE_TAKEAWAY_GROUP: MenuOptionGroup[] = [
  {
    key: "takeaway",
    title: "กลับบ้าน",
    helper: "เลือกได้มากสุด 1 รายการ",
    min: 0,
    max: 1,
    options: [{ label: "กลับบ้าน", price: 0 }],
  },
];

/** ค่าเริ่มต้นตามหมวด (ใช้เมื่อเมนูยังไม่ได้ตั้งค่าตัวเลือกเอง) */
function categoryDefaultGroups(category: string): MenuOptionGroup[] {
  if (category === "ก๋วยเตี๋ยว") return NOODLE_GROUPS;
  if (category === "เกาเหลา") return NOODLE_GROUPS.filter((g) => g.key !== "noodle");
  if (category === "ข้าว") return RICE_GROUPS;
  if (category === "คาเฟ่") return CAFE_GROUPS;
  return SIMPLE_TAKEAWAY_GROUP;
}

/** โครงตัวเลือกที่ใช้ตอนแก้ไข (เก็บลง DB เป็น JSON) */
export type OptionGroupInput = {
  title: string;
  min: number;
  max: number;
  options: MenuOption[];
};

/** ข้อความช่วยเหลืออัตโนมัติจาก min/max */
export function optionHelperText(min: number, max: number) {
  if (min > 0) return `เลือกอย่างน้อย ${min} รายการ`;
  return `เลือกได้มากสุด ${max} รายการ`;
}

/**
 * แปลง JSON ที่เก็บในเมนู → MenuOptionGroup[]
 * - null/พัง = ยังไม่ได้ตั้งค่า (คืน null เพื่อ fallback ตามหมวด)
 * - "[]" = ตั้งใจไม่มีตัวเลือก (คืน [])
 */
export function parseOptionGroups(json: string | null | undefined): MenuOptionGroup[] | null {
  if (json == null || json === "") return null;
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return null;
    return arr
      .map((g, i) => {
        const min = Number(g.min) || 0;
        const max = Number(g.max) || 1;
        return {
          key: `g${i}`,
          title: String(g.title ?? `ตัวเลือก ${i + 1}`),
          min,
          max,
          helper: optionHelperText(min, max),
          options: (Array.isArray(g.options) ? g.options : [])
            .map((o: { label?: unknown; price?: unknown }) => ({
              label: String(o.label ?? ""),
              price: Number(o.price) || 0,
            }))
            .filter((o: MenuOption) => o.label.trim() !== ""),
        };
      })
      .filter((g) => g.options.length > 0);
  } catch {
    return null;
  }
}

export function getMenuOptionGroups(
  product: { category: string; name: string; options?: string | null },
): MenuOptionGroup[] {
  const custom = parseOptionGroups(product.options);
  if (custom !== null) return custom;
  return categoryDefaultGroups(product.category);
}

export function defaultSelections(groups: MenuOptionGroup[]) {
  const selected: Record<string, string[]> = {};
  for (const group of groups) {
    selected[group.key] = group.min > 0 ? [group.options[0]?.label ?? ""] : [];
  }
  return selected;
}

export function selectedOptionDetails(
  groups: MenuOptionGroup[],
  selected: Record<string, string[]>,
) {
  return groups.flatMap((group) =>
    (selected[group.key] ?? []).flatMap((label) => {
      const option = group.options.find((item) => item.label === label);
      return option ? [{ groupTitle: group.title, ...option }] : [];
    }),
  );
}

export function selectedOptionTotal(
  groups: MenuOptionGroup[],
  selected: Record<string, string[]>,
) {
  return selectedOptionDetails(groups, selected).reduce((sum, item) => sum + item.price, 0);
}

/** ค่าตัวเลือกเพิ่มสูงสุดที่เป็นไปได้ของเมนูนี้ = ผลรวมของ (option แพงสุด `max` ตัว) ในแต่ละกลุ่ม
 *  ใช้ตรวจว่าราคาต่อหน่วยที่ client ส่งมาอยู่ในช่วงที่ถูกต้อง (กันปลอมราคา) */
export function maxOptionSurcharge(groups: MenuOptionGroup[]): number {
  return groups.reduce((sum, g) => {
    const top = g.options
      .map((o) => Math.max(0, o.price))
      .sort((a, b) => b - a)
      .slice(0, Math.max(0, g.max));
    return sum + top.reduce((s, p) => s + p, 0);
  }, 0);
}

/** ราคาต่อหน่วยที่ยอมรับได้ของเมนู: [ราคาฐาน, ราคาฐาน + ตัวเลือกเพิ่มสูงสุด]
 *  server ใช้ตรวจราคาที่ client ส่งมา — นอกช่วง = ถูกดัดแปลง (C2) */
export function priceBand(
  product: { category: string; name: string; options?: string | null; price: number },
): { min: number; max: number } {
  const base = Math.max(0, product.price);
  return { min: base, max: base + maxOptionSurcharge(getMenuOptionGroups(product)) };
}

export function selectedOptionNote(
  groups: MenuOptionGroup[],
  selected: Record<string, string[]>,
  freeText: string,
) {
  const lines = selectedOptionDetails(groups, selected).map((item) =>
    item.price > 0
      ? `${item.groupTitle}: ${item.label} + ฿${item.price}`
      : `${item.groupTitle}: ${item.label}`,
  );
  const trimmed = freeText.trim();
  if (trimmed) lines.push(`หมายเหตุ: ${trimmed}`);
  return lines.join("\n");
}
