# แอปพิมพ์บิล POS สำหรับ Sunmi

แอป Android เล็กๆ สำหรับเครื่อง **Sunmi V2** (และรุ่นที่มีเครื่องพิมพ์ในตัว)
เปิดเว็บ POS แบบเต็มจอ + ต่อเครื่องพิมพ์ในตัวผ่าน **Sunmi Printer SDK** โดยตรง (ไม่ค้างเหมือน RawBT/Bluetooth)

## ทำงานยังไง

1. แอปโหลด URL ของ POS (ตั้งที่ `posUrl` ใน `MainActivity.kt`) ใน WebView เต็มจอ
2. inject สะพาน `window.SunmiPrint.printBase64(<base64 ESC/POS>)` เข้าหน้าเว็บ
3. เว็บกดปริ้น → `src/lib/thermal.ts` `printBytes()` เจอ bridge → ส่งไบต์ ESC/POS (จาก `src/lib/escpos.ts`) เข้า `SunmiPrinterService.sendRAWData()` → พิมพ์

## Build (ไม่ต้องลง Android Studio)

push โฟลเดอร์นี้ขึ้น GitHub → workflow `.github/workflows/build-print-apk.yml` build APK ให้อัตโนมัติ:
- โหลด APK จากแท็บ **Actions → artifact `print-app`**, หรือ
- workflow copy ให้เองที่ **`public/print-app.apk`** → Vercel เสิร์ฟที่ `https://<โดเมน>/print-app.apk`

Build เองบนเครื่อง (ถ้ามี Android SDK):
```bash
cd sunmi-print-app
gradle assembleDebug        # APK → app/build/outputs/apk/debug/app-debug.apk
```

## ติดตั้งบน Sunmi

1. บน Sunmi เปิดหน้า `/kitchen` ใน Chrome → กดปุ่ม **📥 ติดตั้งแอปพิมพ์ Sunmi** (โหลด `/print-app.apk`)
2. เปิดไฟล์ที่โหลด → Android ขอสิทธิ์ **"ติดตั้งจากแหล่งที่ไม่รู้จัก"** → อนุญาต → ติดตั้ง
3. เปิดแอป **"posee พิมพ์บิล"** (แทนการเปิด Chrome) → ใช้ POS ตามปกติ → กดปริ้นบิลออกที่เครื่องเลย

## เปลี่ยนโดเมน POS

แก้ `posUrl` ใน `app/src/main/java/co/posee/print/MainActivity.kt` แล้ว push ใหม่ (build เอง)

## ปรับแต่ง

- ภาษาไทยเพี้ยน / บิลกว้างเพี้ยน → แก้ฝั่งเว็บ (`THAI_CODE_TABLE`, `RECEIPT_WIDTH` ใน `src/lib/escpos.ts`) ไม่ต้อง build แอปใหม่
- เวอร์ชัน Sunmi SDK: `com.sunmi:printerlibrary` ใน `app/build.gradle`
