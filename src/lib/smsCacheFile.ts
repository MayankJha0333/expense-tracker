import { File, Paths } from 'expo-file-system';

/*
 * Where the kept bank messages live between starts: one file in this app's private folder on the phone.
 * Other apps can't read it, Android cloud backup is off (app.json "allowBackup": false), and
 * "Delete all my data" removes it. See lib/smsCache.ts for what goes in it.
 */

const NAME = 'sms-cache.json';
const file = () => new File(Paths.document, NAME);

export async function readCacheFile(): Promise<string | null> {
  try {
    const f = file();
    return f.exists ? await f.text() : null;
  } catch {
    return null;
  }
}

export async function writeCacheFile(text: string): Promise<void> {
  try {
    const f = file();
    if (!f.exists) f.create();
    await f.write(text);
  } catch {
    // A cache that can't be saved only means the next start reads the whole inbox again.
  }
}

export function deleteCacheFile(): void {
  try {
    const f = file();
    if (f.exists) f.delete();
  } catch {
    // Nothing to delete, or no access: either way there is no cache left to read.
  }
}
