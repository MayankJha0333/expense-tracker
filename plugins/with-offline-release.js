const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/*
 * Release builds get no network permission at all, so Android itself refuses
 * to open a socket for the app. Debug builds keep INTERNET because they load
 * JavaScript from Metro over localhost.
 *
 * A build-type manifest outranks the main and library manifests, so
 * tools:node="remove" here strips the permission even when a library adds it.
 */
const RELEASE_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.INTERNET" tools:node="remove" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" tools:node="remove" />
    <uses-permission android:name="android.permission.ACCESS_WIFI_STATE" tools:node="remove" />
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove" />
</manifest>
`;

module.exports = function withOfflineRelease(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'release');
      await fs.promises.mkdir(dir, { recursive: true });
      await fs.promises.writeFile(path.join(dir, 'AndroidManifest.xml'), RELEASE_MANIFEST);
      return cfg;
    },
  ]);
};
