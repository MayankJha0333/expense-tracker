import { I18nManager } from 'react-native';

/**
 * The phone's language + region ("en-US", "en_IN"), or null. Used only to guess the
 * home currency before there are any payments. Read on the phone; nothing is sent anywhere.
 */
export function deviceLocale(): string | null {
  const candidates: (string | undefined)[] = [];
  try {
    const c = (I18nManager.getConstants?.() ?? {}) as { localeIdentifier?: string };
    candidates.push(c.localeIdentifier);
  } catch {
    // Not available on this platform.
  }
  try {
    candidates.push(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    // No Intl support.
  }
  // Prefer one that names a region ("en-US" over "en").
  return candidates.find((l) => !!l && /[-_][A-Za-z]{2}\b/.test(l)) ?? candidates.find((l) => !!l) ?? null;
}
