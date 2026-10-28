import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { InstallInfo } from './SmsReader.types';

declare class DeviceGuardModule extends NativeModule<{}> {
  /** How this copy of the app was installed. */
  installInfo(): InstallInfo;
}

export default requireOptionalNativeModule<DeviceGuardModule>('DeviceGuard');
