package expo.modules.smsreader

import android.Manifest
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.net.DatagramSocket

/**
 * Lets the app check its own privacy guarantees on the device:
 * whether Android lets it open a network socket at all, and how it was
 * installed (which decides whether Android restricts SMS access).
 */
class DeviceGuardModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("DeviceGuard")

    Function("networkStatus") {
      val ctx = appContext.reactContext
      val requested = ctx?.packageManager
        ?.getPackageInfo(ctx.packageName, PackageManager.GET_PERMISSIONS)
        ?.requestedPermissions
        ?.contains(Manifest.permission.INTERNET) == true

      // Binding a local UDP socket sends nothing, but the kernel refuses it
      // with EACCES when the app has no INTERNET permission.
      var socketError: String? = null
      try {
        DatagramSocket().close()
      } catch (e: Exception) {
        socketError = e.message ?: e.javaClass.simpleName
      }

      val backupAllowed = ctx != null && (ctx.applicationInfo.flags and ApplicationInfo.FLAG_ALLOW_BACKUP) != 0

      mapOf(
        "internetPermission" to requested,
        "backupAllowed" to backupAllowed,
        "socketBlocked" to (socketError != null),
        "socketError" to socketError
      )
    }

    Function("installInfo") {
      val ctx = appContext.reactContext
      var installer: String? = null
      var source = "unknown"
      if (ctx != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        val info = ctx.packageManager.getInstallSourceInfo(ctx.packageName)
        installer = info.installingPackageName
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
          source = when (info.packageSource) {
            PackageInstaller.PACKAGE_SOURCE_STORE -> "store"
            PackageInstaller.PACKAGE_SOURCE_LOCAL_FILE -> "local_file"
            PackageInstaller.PACKAGE_SOURCE_DOWNLOADED_FILE -> "downloaded_file"
            PackageInstaller.PACKAGE_SOURCE_OTHER -> "other"
            else -> "unspecified"
          }
        }
      }
      mapOf(
        "sdk" to Build.VERSION.SDK_INT,
        "installer" to installer,
        "source" to source
      )
    }
  }
}
