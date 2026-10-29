import { Linking, PermissionsAndroid, Platform } from 'react-native';

import SmsReader, { DeviceGuard } from '../../modules/sms-reader';
import type { InboxResult, InstallInfo } from '../../modules/sms-reader';

/**
 * - blocked: you said no and Android won't ask again. Fix in App info → Permissions.
 * - restricted: Android 15+ won't even ask, because the app was installed from a
 *   downloaded APK. Fix in App info → ⋮ → Allow restricted settings, then Permissions.
 * - unavailable: this build has no SMS reader (Expo Go, iOS, web).
 */
export type SmsPermission = 'granted' | 'denied' | 'blocked' | 'restricted' | 'unavailable';

/** True when this build has the native SMS reader (not Expo Go, not iOS). */
export const smsSupported = Platform.OS === 'android' && SmsReader !== null;

export function installInfo(): InstallInfo | null {
  try {
    return DeviceGuard?.installInfo() ?? null;
  } catch {
    return null;
  }
}

/**
 * Android 15 added SMS to the "restricted settings" that sideloaded apps can't
 * get until the user allows them. Apps from a store, or installed with adb, are not affected.
 */
export function sideloadRestricted(info = installInfo()): boolean {
  return !!info && info.sdk >= 35 && (info.source === 'local_file' || info.source === 'downloaded_file');
}

export async function checkSmsPermission(): Promise<SmsPermission> {
  if (!smsSupported) return 'unavailable';
  const ok = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
  return ok ? 'granted' : 'denied';
}

export async function requestSmsPermission(): Promise<SmsPermission> {
  if (!smsSupported) return 'unavailable';
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read your bank SMS',
    message:
      'Kharcha reads bank and card alerts on this phone to track your spending. OTPs, offers and chats are skipped. Nothing is uploaded: Kharcha has no server.',
    buttonPositive: 'Continue',
    buttonNegative: 'Not now',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  // A restricted app gets "never ask again" straight away, without any dialog.
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return sideloadRestricted() ? 'restricted' : 'blocked';
  return 'denied';
}

/** Opens this app's page in Android Settings (App info). */
export const openAppSettings = () => Linking.openSettings();

const MONTHS_BACK = 13;
const MAX_MESSAGES = 8000;

/** Reads about the last 13 months of inbox messages from non-personal senders. */
/** Development builds only: a test inbox put here by hand stands in for the phone's SMS. See scripts/scan-sms.ts. */
type DevGlobals = { __KHARCHA_TEST_INBOX__?: InboxResult; __KHARCHA_RESCAN__?: () => Promise<void> };
export const devGlobals = globalThis as DevGlobals;
const isDev = typeof __DEV__ !== 'undefined' && __DEV__;

export async function readInbox(): Promise<InboxResult> {
  if (isDev && devGlobals.__KHARCHA_TEST_INBOX__) return devGlobals.__KHARCHA_TEST_INBOX__;
  if (!SmsReader) throw new Error('SMS reader is not in this build');
  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_BACK, 1);
  since.setHours(0, 0, 0, 0);
  return SmsReader.readInboxAsync(since.getTime(), MAX_MESSAGES);
}
