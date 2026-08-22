package co.posee.print

import android.app.Activity
import android.os.Bundle
import android.util.Base64
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import com.sunmi.peripheral.printer.InnerPrinterCallback
import com.sunmi.peripheral.printer.InnerPrinterException
import com.sunmi.peripheral.printer.InnerPrinterManager
import com.sunmi.peripheral.printer.SunmiPrinterService

/**
 * แอปครอบเว็บ POS + สะพานพิมพ์เข้าเครื่องพิมพ์ในตัว Sunmi
 *
 * เว็บเรียก window.SunmiPrint.printBase64(<base64 ESC/POS>) → ส่งเข้า SunmiPrinterService.sendRAWData()
 * (ฝั่งเว็บสร้างไบต์ ESC/POS เอง ที่ src/lib/escpos.ts และเรียกผ่าน printBytes() ใน src/lib/thermal.ts)
 */
class MainActivity : Activity() {

    // ── เปลี่ยนโดเมน POS ตรงนี้ถ้าย้ายที่อยู่เว็บ ──
    private val posUrl = "https://your-pos-domain.example"

    private var printerService: SunmiPrinterService? = null

    private val printerCallback = object : InnerPrinterCallback() {
        override fun onConnected(service: SunmiPrinterService) {
            printerService = service
        }
        override fun onDisconnected() {
            printerService = null
        }
    }

    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        bindPrinter()

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            keepScreenOn = true // จอครัวไม่ดับ
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            webViewClient = WebViewClient()   // เปิดลิงก์ในแอป ไม่เด้งออกเบราว์เซอร์
            webChromeClient = WebChromeClient()
            addJavascriptInterface(PrintBridge(), "SunmiPrint")
        }
        setContentView(webView)
        webView.loadUrl(posUrl)
    }

    private fun bindPrinter() {
        try {
            InnerPrinterManager.getInstance().bindService(applicationContext, printerCallback)
        } catch (e: InnerPrinterException) {
            e.printStackTrace()
        }
    }

    override fun onDestroy() {
        try {
            InnerPrinterManager.getInstance().unBindService(applicationContext, printerCallback)
        } catch (_: Exception) {
        }
        super.onDestroy()
    }

    @Deprecated("รองรับปุ่มย้อนกลับใน WebView")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    /** สะพาน JS → เครื่องพิมพ์ (ทำงานบน binder thread ไม่ใช่ UI thread) */
    inner class PrintBridge {
        @JavascriptInterface
        fun printBase64(b64: String) {
            val data = try {
                Base64.decode(b64, Base64.DEFAULT)
            } catch (e: Exception) {
                return
            }
            val svc = printerService
            if (svc == null) {
                toast("เครื่องพิมพ์ยังไม่พร้อม กำลังเชื่อมใหม่…")
                bindPrinter()
                return
            }
            try {
                svc.sendRAWData(data, null)
            } catch (e: Exception) {
                toast("พิมพ์ไม่สำเร็จ: ${e.message}")
            }
        }
    }

    private fun toast(msg: String) {
        runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show() }
    }
}
