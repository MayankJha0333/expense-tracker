import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';

import { toVersionCode, updateKind, type UpdateKind } from './versionRule';

/*
 * Asks Google Play (through the Play Store app on this phone) whether a newer build exists.
 * Kharcha sends nothing of its own here; Google Play answers from its own data.
 *
 * Works only in builds installed from Google Play. Sideloaded and development builds,
 * or builds made before these native modules were added, quietly report "no update".
 */

export type UpdateStatus = { kind: UpdateKind; immediateAllowed: boolean };

const NONE: UpdateStatus = { kind: 'none', immediateAllowed: false };
const PACKAGE = Constants.expoConfig?.android?.package ?? 'com.mayankjha.kharcha';

// Both libraries load their native code on import, so check it is in this build first.
const supported = () =>
  Platform.OS === 'android' && !!requireOptionalNativeModule('ExpoInAppUpdates') && !!requireOptionalNativeModule('ExpoApplication');

export async function checkStoreUpdate(): Promise<UpdateStatus> {
  if (!supported()) return NONE;
  try {
    const [updates, app] = await Promise.all([import('expo-in-app-updates'), import('expo-application')]);
    const info = await updates.checkForUpdate();
    if (!info.updateAvailable) return NONE;
    return {
      kind: updateKind(toVersionCode(app.nativeBuildVersion), toVersionCode(info.storeVersion)),
      immediateAllowed: !!info.immediateAllowed,
    };
  } catch {
    // Not installed from Play, offline, or no Play Store on this phone.
    return NONE;
  }
}

/** Play's full-screen update when it can run; otherwise Kharcha's Play Store page. */
export async function startForcedUpdate(immediateAllowed: boolean): Promise<void> {
  if (immediateAllowed && supported()) {
    try {
      const updates = await import('expo-in-app-updates');
      if (await updates.startUpdate(true)) return;
    } catch {
      // Fall through to the store page.
    }
  }
  await openStorePage();
}

export async function openStorePage(): Promise<void> {
  try {
    await Linking.openURL(`market://details?id=${PACKAGE}`);
  } catch {
    await Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`).catch(() => {});
  }
}
