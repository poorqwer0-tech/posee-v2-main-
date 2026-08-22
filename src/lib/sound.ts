"use client";

/**
 * เล่นไฟล์เสียงพูด (จาก ElevenLabs, เก็บใน /public/audio)
 * พร้อมเพลงคลอ "มุ้งมิ้ง" (music-bed.mp3) เล่นเบาๆ ใต้ทุกประโยค
 * ถ้าไฟล์ไม่มี/เล่นไม่ได้ จะสำรองด้วยเสียงสังเคราะห์ในเบราว์เซอร์ (ภาษาไทย)
 *
 * ใช้ Audio element เดิมซ้ำต่อ 1 src (cache) เพราะ browser autoplay policy
 * ยอมให้ "เล่นซ้ำ" element ที่เคยถูกเล่นด้วยการกดปุ่มมาก่อน
 */
const BED_SRC = "/audio/music-bed.mp3";
const BED_VOLUME = 0.16;

const cache =
  typeof window !== "undefined" ? new Map<string, HTMLAudioElement>() : null;
let bedEl: HTMLAudioElement | null = null;
let bedStopTimer: ReturnType<typeof setTimeout> | undefined;

function getAudio(src: string): HTMLAudioElement {
  let a = cache!.get(src);
  if (!a) {
    a = new Audio(src);
    a.preload = "auto";
    cache!.set(src, a);
  }
  return a;
}

function getBed(): HTMLAudioElement {
  if (!bedEl) {
    bedEl = new Audio(BED_SRC);
    bedEl.loop = true;
    bedEl.preload = "auto";
  }
  return bedEl;
}

function stopBed() {
  if (!bedEl) return;
  try {
    bedEl.pause();
    bedEl.currentTime = 0;
  } catch {
    /* ignore */
  }
}

function startBedUnder(voice: HTMLAudioElement) {
  const b = getBed();
  b.volume = BED_VOLUME;
  try {
    b.currentTime = 0;
    const p = b.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch {
    return;
  }
  // หยุดเพลงคลอเมื่อพูดจบ (+ สำรองด้วย timeout กันค้าง)
  clearTimeout(bedStopTimer);
  voice.onended = stopBed;
  bedStopTimer = setTimeout(stopBed, 8000);
}

export function playVoice(src: string, fallbackText?: string, withBed = true) {
  if (typeof window === "undefined") return;
  try {
    const a = getAudio(src);
    a.muted = false;
    a.currentTime = 0;
    const p = a.play();
    if (withBed) startBedUnder(a);
    if (p && typeof p.catch === "function") {
      p.catch(() => {
        stopBed();
        speakThai(fallbackText);
      });
    }
  } catch {
    speakThai(fallbackText);
  }
}

export function speakThai(text?: string) {
  if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "th-TH";
    u.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {
    /* เงียบไว้ ถ้าเบราว์เซอร์ไม่รองรับ */
  }
}

/**
 * ปลดล็อกการเล่นเสียง (ต้องเรียกตอนผู้ใช้กดปุ่ม เพราะ browser autoplay policy)
 * เล่นเงียบๆ แล้วหยุด เพื่อ "ปลุก" element แต่ละไฟล์ + เพลงคลอ ให้เล่นได้ทีหลัง
 */
export function primeAudio(srcs: string[] = []) {
  if (typeof window === "undefined") return;
  const unlock = (a: HTMLAudioElement) => {
    try {
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          a.muted = false;
        }).catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };
  for (const src of srcs) unlock(getAudio(src));
  unlock(getBed());

  if (window.speechSynthesis) {
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* ignore */
    }
  }
}
