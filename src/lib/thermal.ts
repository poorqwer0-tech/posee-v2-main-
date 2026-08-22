"use client";

import type { PrinterEncoding } from "./escpos";

/**
 * ส่งไบต์ ESC/POS เข้าเครื่องพิมพ์ความร้อน — ลองหลายช่องทางตามลำดับ:
 *   1) Sunmi WebView bridge  (window.SunmiPrint / window.sunmiInnerPrinter)  ← เครื่องพิมพ์ในตัว Sunmi
 *   2) Local print bridge    (POST http://127.0.0.1 — แอปตัวกลางบนเครื่อง)   ← เปิดผ่าน Chrome ปกติได้
 *   3) Web Serial            (Chrome/Edge + เครื่องพิมพ์ USB/serial)          ← เดสก์ท็อป
 * ถ้าไม่มีช่องทางไหนได้เลย → คืน false ให้ผู้เรียก fallback ไป window.print()
 *
 * ⚠️ ทดสอบกับเครื่องพิมพ์จริงไม่ได้ในตอนพัฒนา — ต้องลองกับเครื่องจริง
 */

/** URL ของแอปตัวกลางบนเครื่อง (ตั้งค่าได้ที่ localStorage["pos-print-url"]) */
const DEFAULT_LOCAL_PRINT_URL = "http://127.0.0.1:9100/print";

function localPrintUrl(): string {
  if (typeof localStorage === "undefined") return DEFAULT_LOCAL_PRINT_URL;
  return localStorage.getItem("pos-print-url") || DEFAULT_LOCAL_PRINT_URL;
}

/** Uint8Array → base64 (สำหรับ JS bridge ที่รับ string) */
function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/* ─────────── ช่องทาง 1: Sunmi WebView bridge ─────────── */

type SunmiBridge = {
  // สัญญาของ wrapper ที่เราคุมเอง (แนะนำ)
  printBase64?: (b64: string) => void;
  // ปลั๊กอิน sunmiInnerPrinter (cordova) — ส่ง raw ESC/POS พร้อม callback
  sendRAWData?: (b64: string, ok?: () => void, err?: (e: unknown) => void) => void;
};

function sunmiBridge(): SunmiBridge | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SunmiPrint?: SunmiBridge; sunmiInnerPrinter?: SunmiBridge };
  return w.SunmiPrint ?? w.sunmiInnerPrinter ?? null;
}

export function hasSunmiBridge(): boolean {
  return sunmiBridge() !== null;
}

/** ควรเสนอปุ่มติดตั้งแอปพิมพ์ Sunmi มั้ย — Android + ยังไม่มี bridge (คือยังเปิดผ่าน Chrome) */
export function shouldOfferPrintApp(): boolean {
  return isAndroid() && !hasSunmiBridge();
}

/** เลือกโหมดเข้ารหัสข้อความให้ตรงเครื่องพิมพ์: Sunmi = utf8, อื่นๆ = tis620
 *  (บังคับได้ที่ localStorage["pos-print-encoding"] = "utf8" | "tis620") */
export function escposEncoding(): PrinterEncoding {
  if (typeof localStorage !== "undefined") {
    const v = localStorage.getItem("pos-print-encoding");
    if (v === "utf8" || v === "tis620") return v;
  }
  return hasSunmiBridge() ? "utf8" : "tis620";
}

async function printViaSunmi(bytes: Uint8Array): Promise<boolean> {
  const b = sunmiBridge();
  if (!b) return false;
  const b64 = toBase64(bytes);
  try {
    if (typeof b.printBase64 === "function") {
      b.printBase64(b64);
      return true;
    }
    if (typeof b.sendRAWData === "function") {
      return await new Promise<boolean>((resolve) => {
        let done = false;
        const finish = (v: boolean) => { if (!done) { done = true; resolve(v); } };
        b.sendRAWData!(b64, () => finish(true), () => finish(false));
        setTimeout(() => finish(true), 1500); // bridge บางตัวไม่เรียก callback
      });
    }
  } catch {
    return false;
  }
  return false;
}

/* ─────────── ช่องทาง 2: RawBT (แอปฟรีบน Play Store) ─────────── */
// RawBT รับ ESC/POS ผ่าน intent URL แล้วสั่งพิมพ์ → รองรับเครื่องพิมพ์ในตัว Sunmi
// ติดตั้งแอป RawBT + ตั้งเป็น "internal printer" ครั้งเดียว ไม่ต้องเขียนแอปเอง

function isAndroid(): boolean {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
}

/** โหมดเครื่องพิมพ์ต่อเครื่อง: "auto" | "rawbt" | "browser" (ตั้งที่ localStorage["pos-print-mode"]) */
function printMode(): string {
  if (typeof localStorage === "undefined") return "auto";
  return localStorage.getItem("pos-print-mode") || "auto";
}

function printViaRawBT(bytes: Uint8Array): boolean {
  if (typeof document === "undefined") return false;
  try {
    const b64 = toBase64(bytes);
    // ถ้ายังไม่ติดตั้ง RawBT เบราว์เซอร์จะเด้งไปหน้า Play Store ให้เอง
    const url =
      "intent:base64," + b64 +
      "#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;";
    const a = document.createElement("a");
    a.href = url;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return true; // intent ยิงแล้ว (ไม่มี ack กลับมา ถือว่าส่งสำเร็จ)
  } catch {
    return false;
  }
}

/* ─────────── ช่องทาง 3: Local print bridge (127.0.0.1) ─────────── */

async function printViaLocalBridge(bytes: Uint8Array): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  try {
    const res = await fetch(localPrintUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      // ส่งสำเนา (ArrayBuffer) กัน type ของ BodyInit เพี้ยนข้าม runtime
      body: bytes.slice().buffer,
      // แอปตัวกลางอาจไม่ส่ง CORS header — no-cors ให้ยิงถึงได้ (opaque response)
      mode: "no-cors",
    });
    // no-cors → res.ok อ่านไม่ได้ (opaque) แต่ถ้าไม่ throw ถือว่าส่งถึงแล้ว
    return res.type === "opaque" || res.ok;
  } catch {
    return false;
  }
}

/* ─────────── ช่องทาง 4: Web Serial (เดิม) ─────────── */

// Web Serial ยังไม่มีใน lib.dom มาตรฐานทุกเวอร์ชัน → ประกาศ type แบบหลวมๆ
type SerialLike = {
  requestPort: () => Promise<SerialPortLike>;
  getPorts: () => Promise<SerialPortLike[]>;
};
type SerialPortLike = {
  open: (opts: { baudRate: number }) => Promise<void>;
  writable: { getWriter: () => { write: (d: Uint8Array) => Promise<void>; releaseLock: () => void } } | null;
};

function serial(): SerialLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { serial?: SerialLike }).serial ?? null;
}

export function isThermalSupported(): boolean {
  return serial() !== null;
}

let cachedPort: SerialPortLike | null = null;

/** ให้ผู้ใช้เลือกเครื่องพิมพ์ (ต้องเรียกจากการกดปุ่ม) */
export async function connectThermalPrinter(): Promise<boolean> {
  const s = serial();
  if (!s) return false;
  try {
    cachedPort = await s.requestPort();
    await cachedPort.open({ baudRate: 9600 });
    return true;
  } catch {
    cachedPort = null;
    return false;
  }
}

/** ส่งไบต์เข้าเครื่องพิมพ์ที่เลือกไว้ (คืน false ถ้ายังไม่เชื่อม/ไม่รองรับ) */
export async function printThermal(bytes: Uint8Array): Promise<boolean> {
  const s = serial();
  if (!s) return false;

  // ถ้ายังไม่มี port ที่เชื่อมไว้ ลองใช้ตัวที่เคยอนุญาต
  if (!cachedPort) {
    const ports = await s.getPorts().catch(() => []);
    if (ports[0]) {
      cachedPort = ports[0];
      try {
        await cachedPort.open({ baudRate: 9600 });
      } catch {
        /* อาจเปิดค้างอยู่แล้ว */
      }
    }
  }
  if (!cachedPort || !cachedPort.writable) return false;

  try {
    const writer = cachedPort.writable.getWriter();
    await writer.write(bytes);
    writer.releaseLock();
    return true;
  } catch {
    return false;
  }
}

/* ─────────── orchestrator ─────────── */

/**
 * ส่งไบต์เข้าเครื่องพิมพ์ — ลองตามลำดับ: Sunmi bridge → RawBT → local bridge → Web Serial
 * คืน true ถ้าช่องทางใดสำเร็จ, false ถ้าไม่มีเลย (ให้ผู้เรียก fallback window.print())
 *
 * โหมด (localStorage["pos-print-mode"]):
 *   "browser" → ข้ามทุกช่องทาง ใช้ window.print() เลย
 *   "rawbt"   → บังคับใช้ RawBT (แม้ไม่ใช่ Android)
 *   "auto"    → (ค่าเริ่มต้น) บน Android ลอง RawBT ให้เอง
 */
export async function printBytes(bytes: Uint8Array): Promise<boolean> {
  const mode = printMode();
  if (mode === "browser") return false;

  if (await printViaSunmi(bytes)) return true;
  if ((mode === "rawbt" || isAndroid()) && printViaRawBT(bytes)) return true;
  if (await printViaLocalBridge(bytes)) return true;
  if (await printThermal(bytes)) return true;
  return false;
}
