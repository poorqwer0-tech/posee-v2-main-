import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/**
 * hash รหัสผ่านด้วย scrypt (built-in ไม่ต้องลง lib เพิ่ม)
 * เก็บเป็น "salt:hash" (hex) — ใช้ในฝั่ง server เท่านั้น (Node runtime)
 */
export function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = randomBytes(16).toString("hex");
    scrypt(password, salt, 64, (err, derived) => {
      if (err) return reject(err);
      resolve(`${salt}:${derived.toString("hex")}`);
    });
  });
}

/** ตรวจรหัสผ่านแบบ timing-safe */
export function verifyPassword(password: string, stored: string): Promise<boolean> {
  return new Promise((resolve) => {
    const [salt, hashHex] = stored.split(":");
    if (!salt || !hashHex) return resolve(false);
    scrypt(password, salt, 64, (err, derived) => {
      if (err) return resolve(false);
      const a = Buffer.from(hashHex, "hex");
      if (a.length !== derived.length) return resolve(false);
      resolve(timingSafeEqual(a, derived));
    });
  });
}
