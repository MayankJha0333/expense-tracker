import type { ConfigContext, ExpoConfig } from 'expo/config';

/*
 * app.json holds the real settings. This file only changes them for a dev copy:
 *   APP_VARIANT=development npx expo run:android
 * installs "Kharcha Dev" (com.mayankjha.kharcha.dev) next to the Play Store app,
 * so testing new code never touches the store app or its data.
 * Release builds (CI, EAS production) don't set APP_VARIANT and are unchanged.
 */
const IS_DEV = process.env.APP_VARIANT === 'development';

export default ({ config }: ConfigContext): ExpoConfig => {
  if (!IS_DEV) return config as ExpoConfig;
  return {
    ...config,
    name: 'Kharcha Dev',
    slug: config.slug ?? 'kharcha',
    scheme: 'kharcha-dev',
    android: { ...config.android, package: 'com.mayankjha.kharcha.dev' },
    ios: { ...config.ios, bundleIdentifier: 'com.mayankjha.kharcha.dev' },
  };
};
