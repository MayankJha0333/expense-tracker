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
 *
 * Offers from promotional senders (headers ending in "-P", like "AX-BRAND-P") are dropped here too,
 * so they don't use up the message limit. The app skips them anyway. The only ones kept are
 * credit card bill reminders and autopay notices, which apps sometimes send from promotional headers.
 */
class SmsReaderModule : Module() {

  private val personalNumber = Regex("^\\+?\\d{10,}$")
  private val promoSender = Regex("-P$", RegexOption.IGNORE_CASE)
  private val promoKeep = Regex("credit\\s*card|card\\s*bill|auto\\s*pay|mandate", RegexOption.IGNORE_CASE)

  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    Function("hasPermission") {
      val ctx = appContext.reactContext
      ctx != null && ctx.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
    }

    // countAfterMs: personal and promotional messages are counted only when newer than this, so a
    // read that overlaps the previous one (to catch late messages) doesn't count them twice.
    AsyncFunction("readInboxAsync") { sinceMs: Double, limit: Int, countAfterMs: Double ->
      val ctx = appContext.reactContext ?: throw IllegalStateException("Android context is not ready")
      if (ctx.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
        throw SecurityException("SMS permission is not granted")
      }

      val messages = ArrayList<Map<String, Any>>()
      var scanned = 0
      var personalSkipped = 0
      var promoSkipped = 0
      var limitReached = false
      var oldest: Double? = null

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

        while (c.moveToNext()) {
          val date = c.getLong(dateCol).toDouble()
          val address = c.getString(addressCol) ?: ""
          val compact = address.replace(" ", "").replace("-", "")
          if (address.isEmpty() || personalNumber.matches(compact)) {
            if (date > countAfterMs) personalSkipped++
            continue
          }
          val body = c.getString(bodyCol) ?: ""
          if (promoSender.containsMatchIn(address.trim()) && !promoKeep.containsMatchIn(body)) {
            if (date > countAfterMs) promoSkipped++
            continue
          }
          if (messages.size >= limit) {
            // A message we would have kept is left out: older months are not read.
            limitReached = true
            break
          }
          scanned++
          messages.add(
            mapOf(
              "id" to c.getLong(idCol).toString(),
              "sender" to address,
              "body" to body,
              "date" to date
            )
          )
          oldest = date
        }
      }

      val result = mutableMapOf<String, Any>(
        "messages" to messages,
        "scanned" to scanned,
        "personalSkipped" to personalSkipped,
        "promoSkipped" to promoSkipped,
        "limitReached" to limitReached
      )
      oldest?.let { result["oldest"] = it }
      result
    }
  }
}
