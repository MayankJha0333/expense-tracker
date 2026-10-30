import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { InboxResult } from './SmsReader.types';

declare class SmsReaderModule extends NativeModule<{}> {
  /** True when the READ_SMS permission is already granted. */
  hasPermission(): boolean;
  /**
   * Inbox messages newer than [sinceMs], newest first, at most [limit]. Personal numbers and offers
   * from promotional senders are dropped first and don't count toward [limit]; they are counted in
   * the result only when newer than [countAfterMs] (0 = count all).
   */
  readInboxAsync(sinceMs: number, limit: number, countAfterMs: number): Promise<InboxResult>;
}

/**
 * Null when the native code is not in this build (for example inside Expo Go).
 * Run `npx expo run:android` to get a build that has it.
 */
export default requireOptionalNativeModule<SmsReaderModule>('SmsReader');
