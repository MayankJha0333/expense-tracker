const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/*
 * Release builds drop the "draw over other apps" permission. React Native adds it
 * only for the developer menu, which release builds don't have.
 *
 * A build-type manifest outranks the main and library manifests, so
 * tools:node="remove" here strips the permission even when a library adds it.
 */
const RELEASE_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" tools:node="remove" />
</manifest>
`;

module.exports = function withReleasePermissions(config) {
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
