"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** วาด QR ในเครื่องเป็น data-URI (ไม่พึ่งเว็บนอก) → ใช้งาน offline ได้
 *  text = ข้อความที่จะเข้ารหัส (ลิงก์โต๊ะ หรือ payload PromptPay) */
export function QrImage({
  text,
  size = 240,
  alt = "QR",
  className,
}: {
  text: string;
  size?: number;
  alt?: string;
  className?: string;
}) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(text, { width: size, margin: 2 })
      .then((url) => active && setSrc(url))
      .catch(() => active && setSrc(""));
    return () => {
      active = false;
    };
  }, [text, size]);

  // ระหว่างวาด (หรือวาดไม่สำเร็จ) โชว์กล่องเปล่าขนาดเท่ากันกันเลย์เอาต์เด้ง
  if (!src) {
    return <div style={{ width: size, height: size }} className={className} aria-label={alt} />;
  }
  return <img src={src} width={size} height={size} alt={alt} className={className} />;
}
