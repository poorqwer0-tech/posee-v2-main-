/**
 * สร้างเพลงคลอ "มุ้งมิ้ง" ที่จะเล่นเบาๆ ใต้ทุกประโยคพูด (รันด้วย `npm run music:gen`)
 * ผลลัพธ์: public/audio/music-bed.mp3
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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
const OUT = join(process.cwd(), "public", "audio", "music-bed.mp3");

const PROMPT =
  "Cute dreamy sparkly music box, twinkly celesta and glockenspiel bells, " +
  "soft magical shimmer, whimsical kawaii mood, light and airy, gentle and warm, " +
  "no heavy drums, instrumental, seamless loop.";
const LENGTH_MS = 12000;

async function main() {
  if (!API_KEY) {
    console.error("❌ ยังไม่ได้ตั้ง ELEVENLABS_API_KEY ใน .env");
    process.exit(1);
  }
  mkdirSync(join(process.cwd(), "public", "audio"), { recursive: true });

  console.log(`🎵 กำลังแต่งเพลงคลอมุ้งมิ้ง (${LENGTH_MS / 1000} วินาที)...`);
  const res = await fetch("https://api.elevenlabs.io/v1/music", {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ prompt: PROMPT, music_length_ms: LENGTH_MS }),
  });

  if (!res.ok) {
    console.error(`❌ Music API ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  writeFileSync(OUT, Buffer.from(await res.arrayBuffer()));
  console.log(`🎉 เสร็จแล้ว! → public/audio/music-bed.mp3`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ แต่งเพลงไม่สำเร็จ:", err.message);
  process.exit(1);
});
