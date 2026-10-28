/*
 * How Android build numbers (versionCode) carry the major version, so the app can tell
 * a major update from a small one without any server:
 *
 *   versionCode = major × 1000 + build number
 *   1.0.0 → 1001, then 1002, 1003 … for every new Play upload of 1.x
 *   2.0.0 → 2001, 2002 …
 *
 * A Play Store build in a higher thousand than the installed one is a major update,
 * and the app asks people to update before they carry on. See docs/RELEASING.md.
 * No React Native imports here, so the tests can run this file in plain Node.
 */

export const MAJOR_STEP = 1000;

export type UpdateKind = 'none' | 'minor' | 'major';

export const majorOf = (versionCode: number) => Math.floor(versionCode / MAJOR_STEP);

/** "2001" or 2001 → 2001. Anything else → null. */
export function toVersionCode(value: unknown): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Compare the installed build with the newest one on the Play Store. Unknown numbers never force an update. */
export function updateKind(installed: number | null, store: number | null): UpdateKind {
  if (installed === null || store === null || store <= installed) return 'none';
  return majorOf(store) > majorOf(installed) ? 'major' : 'minor';
}
