"use client";

/**
 * ย่อรูปในเบราว์เซอร์ → data URI (JPEG) เก็บลง DB ได้เลย ไม่ต้องมี storage แยก
 * ย่อให้ด้านยาวสุดไม่เกิน maxSize px + บีบคุณภาพ เพื่อให้ไฟล์เล็ก (~30-80KB)
 */
export function resizeImageToDataUrl(
  file: File,
  maxSize = 500,
  quality = 0.8,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่ได้"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("ไฟล์ไม่ใช่รูปภาพ"));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("แปลงรูปไม่ได้"));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
