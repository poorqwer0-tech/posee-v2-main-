import { networkInterfaces } from "node:os";

/** หา IPv4 ในวง LAN ของเครื่อง (สำหรับสร้างลิงก์/QR ให้ staff เข้าผ่าน Wi-Fi ร้าน)
 *  คืน private IP (192.168/10/172.16-31) ก่อน, ไม่มีค่อย fallback เป็น non-internal ตัวแรก */
export function lanIpv4(): string | null {
  const nets = networkInterfaces();
  const all: string[] = [];
  for (const list of Object.values(nets)) {
    for (const net of list ?? []) {
      if (net.family === "IPv4" && !net.internal) all.push(net.address);
    }
  }
  const isPrivate = (a: string) =>
    a.startsWith("192.168.") ||
    a.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(a);
  return all.find(isPrivate) ?? all[0] ?? null;
}
