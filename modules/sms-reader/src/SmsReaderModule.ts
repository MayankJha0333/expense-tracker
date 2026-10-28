import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { InboxResult } from './SmsReader.types';

declare class SmsReaderModule extends NativeModule<{}> {
  /** True when the READ_SMS permission is already granted. */
  hasPermission(): boolean;
  /** Inbox messages newer than [sinceMs], newest first, at most [limit]. */
  readInboxAsync(sinceMs: number, limit: number): Promise<InboxResult>;
}

/**
 * Null when the native code is not in this build (for example inside Expo Go).
 * Run `npx expo run:android` to get a build that has it.
 */
export default requireOptionalNativeModule<SmsReaderModule>('SmsReader');
