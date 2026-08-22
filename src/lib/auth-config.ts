/**
 * รหัส admin ตั้งต้นจาก env (fast-path non-interactive เท่านั้น)
 * คืน "" ถ้าไม่ได้ตั้ง → ไม่สร้าง admin รหัสอ่อน, ให้ /setup wizard สร้างเอง
 * (เดิม fallback "1234" = ทุก install ที่ไม่ตั้ง env มี admin รหัส 1234 = เดาง่าย)
 */
export function bootstrapAdminPassword(): string {
  return process.env.POS_ADMIN_PASSWORD || "";
}
