package expo.modules.smsreader

import android.Manifest
import android.content.pm.PackageManager
import android.provider.Telephony
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads the SMS inbox on the phone. Nothing leaves the device.
 *
 * Messages from personal phone numbers (+91 98xxx...) are dropped here, in
 * native code, so chats with people never even reach the JavaScript side.
 */
class SmsReaderModule : Module() {

  private val personalNumber = Regex("^\\+?\\d{10,}$")

  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    Function("hasPermission") {
      val ctx = appContext.reactContext
      ctx != null && ctx.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    AsyncFunction("readInboxAsync") { sinceMs: Double, limit: Int ->
      val ctx = appContext.reactContext ?: throw IllegalStateException("Android context is not ready")
      if (ctx.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("SMS permission is not granted")
      }

      val messages = ArrayList<Map<String, Any>>()
      var scanned = 0
      var personalSkipped = 0

      val projection = arrayOf(Telephony.Sms._ID, Telephony.Sms.ADDRESS, Telephony.Sms.BODY, Telephony.Sms.DATE)
      val cursor = ctx.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        projection,
        "${Telephony.Sms.DATE} >= ?",
        arrayOf(sinceMs.toLong().toString()),
        "${Telephony.Sms.DATE} DESC"
      )

      cursor?.use { c ->
        val idCol = c.getColumnIndexOrThrow(Telephony.Sms._ID)
        val addressCol = c.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)
        val bodyCol = c.getColumnIndexOrThrow(Telephony.Sms.BODY)
        val dateCol = c.getColumnIndexOrThrow(Telephony.Sms.DATE)

        while (c.moveToNext() && messages.size < limit) {
          scanned++
          val address = c.getString(addressCol) ?: ""
          val compact = address.replace(" ", "").replace("-", "")
          if (address.isEmpty() || personalNumber.matches(compact)) {
            personalSkipped++
          } else {
            messages.add(
              mapOf(
                "id" to c.getLong(idCol).toString(),
                "sender" to address,
                "body" to (c.getString(bodyCol) ?: ""),
                "date" to c.getLong(dateCol).toDouble()
              )
            )
          }
        }
      }

      mapOf(
        "messages" to messages,
        "scanned" to scanned,
        "personalSkipped" to personalSkipped
      )
    }
  }
}
