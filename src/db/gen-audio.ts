/**
 * สร้างไฟล์เสียงเตือนหน้าครัวด้วย ElevenLabs (รันด้วย `npm run tts:gen`)
 *
 * ต้องตั้งค่าใน .env ก่อน:
 *   ELEVENLABS_API_KEY=xxxxx           (จำเป็น)
 *   ELEVENLABS_VOICE_ID=xxxxx          (ไม่ใส่ก็ได้ ใช้เสียงเริ่มต้น)
 *   ELEVENLABS_MODEL=eleven_multilingual_v2   (ไม่ใส่ก็ได้)
 *
 * ผลลัพธ์จะถูกเขียนไว้ที่ public/audio/*.mp3
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "./index";
import { restaurantTables } from "./schema";

// โหลดค่าใน .env เอง (tsx ไม่โหลดให้อัตโนมัติ)
function loadEnv() {
  try {
    const raw = readFileSync(join(process.cwd(), ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ไม่มี .env ก็ข้าม */
  }
}
loadEnv();

const API_KEY = process.env.ELEVENLABS_API_KEY;
// เสียงมาตรฐานของ ElevenLabs (Rachel) — รองรับภาษาไทยผ่านโมเดล multilingual
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
const MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

const OUT_DIR = join(process.cwd(), "public", "audio");

async function synth(text: string, file: string) {
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": API_KEY as string,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL,
        // v3 ใช้ stability แบบ 0.0/0.5/1.0 และไม่ใช้ style/speaker_boost
        voice_settings: MODEL.includes("v3")
          ? { stability: 0.5, similarity_boost: 0.75 }
          : {
              stability: 0.4,
              similarity_boost: 0.85,
              style: 0.45,
              use_speaker_boost: true,
            },
      }),
    },
  );

  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(join(OUT_DIR, file), buf);
  console.log(`  ✅ ${file}  ("${text}")`);
}

async function main() {
  if (!API_KEY) {
    console.error(
      "❌ ยังไม่ได้ตั้ง ELEVENLABS_API_KEY ใน .env — ใส่ก่อนแล้วรัน `npm run tts:gen` อีกครั้ง",
    );
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  const tables = await db
    .select()
    .from(restaurantTables)
    .where(eq(restaurantTables.isActive, true))
    .all();

  const jobs: { text: string; file: string }[] = [
    { text: "ออเดอร์โต๊ะเข้าจ้า", file: "new-order.mp3" },
    { text: "ออเดอร์พร้อมเสิร์ฟแล้วจ้า", file: "ready.mp3" },
    { text: "มีโต๊ะเรียกเก็บเงินจ้า", file: "payment.mp3" },
    { text: "มีลูกค้าขอเปิดโต๊ะค่ะ", file: "open-request.mp3" },
    ...tables.map((t) => ({
      text: `ออเดอร์${t.name} พร้อมเสิร์ฟแล้วจ้า`,
      file: `ready-${t.qrToken}.mp3`,
    })),
    ...tables.map((t) => ({
      text: `${t.name} เรียกเก็บเงินจ้า`,
      file: `payment-${t.qrToken}.mp3`,
    })),
  ];

  console.log(`🎙️  กำลังสร้างเสียง ${jobs.length} ไฟล์ (voice=${VOICE_ID})...`);
  for (const job of jobs) {
    await synth(job.text, job.file);
  }
  console.log(`\n🎉 เสร็จแล้ว! ไฟล์อยู่ที่ public/audio/`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ สร้างเสียงไม่สำเร็จ:", err.message);
  process.exit(1);
});
