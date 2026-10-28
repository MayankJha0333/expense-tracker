import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { InstallInfo, NetworkStatus } from './SmsReader.types';

declare class DeviceGuardModule extends NativeModule<{}> {
  /** Whether Android would let this app open a network socket. Sends nothing. */
  networkStatus(): NetworkStatus;
  /** How this copy of the app was installed. */
  installInfo(): InstallInfo;
}

export default requireOptionalNativeModule<DeviceGuardModule>('DeviceGuard');
