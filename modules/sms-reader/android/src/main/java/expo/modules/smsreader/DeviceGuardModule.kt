package expo.modules.smsreader

import android.content.pm.PackageInstaller
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Tells the app how this copy was installed, which decides whether
 * Android restricts SMS access (sideloaded apps on Android 15+).
 */
class DeviceGuardModule : Module() {

  override fun definition() = ModuleDefinition {
    Name("DeviceGuard")

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
