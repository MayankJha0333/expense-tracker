import { Linking, PermissionsAndroid, Platform } from 'react-native';

import SmsReader from '../../modules/sms-reader';
import type { InboxResult } from '../../modules/sms-reader';

export type SmsPermission = 'granted' | 'denied' | 'blocked' | 'unavailable';

/** True when this build has the native SMS reader (not Expo Go, not iOS). */
export const smsSupported = Platform.OS === 'android' && SmsReader !== null;

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
      'Kharcha reads bank and card alerts to track your spending. OTPs, offers and chats are skipped. Nothing leaves your phone.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  if (result === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
  return 'denied';
}

export const openAppSettings = () => Linking.openSettings();

const MONTHS_BACK = 13;
const MAX_MESSAGES = 8000;

/** Reads about the last 13 months of inbox messages from non-personal senders. */
export async function readInbox(): Promise<InboxResult> {
  if (!SmsReader) throw new Error('SMS reader is not in this build');
  const since = new Date();
  since.setMonth(since.getMonth() - MONTHS_BACK, 1);
  since.setHours(0, 0, 0, 0);
  return SmsReader.readInboxAsync(since.getTime(), MAX_MESSAGES);
}
