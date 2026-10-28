import { Platform } from 'react-native';

import { DeviceGuard } from '../../modules/sms-reader';

/*
 * Kharcha never uses the network. The real guarantee is on Android itself:
 * release builds ship without the INTERNET permission (plugins/with-offline-release.js),
 * so the system refuses to open any socket for the app.
 *
 * This file adds a second wall in JavaScript and lets the app check both on the device.
 * Development builds skip the JS wall because they load code from Metro over the network.
 */

const REMOTE = /^\s*(https?|wss?):/i;
const MESSAGE = 'Kharcha works offline. Network access is turned off.';

let guardOn = false;
let blocked = 0;

const urlOf = (input: unknown): string => {
  if (typeof input === 'string') return input;
  if (input && typeof input === 'object' && 'url' in input) return String((input as { url: unknown }).url);
  return String(input);
};

/** Refuse every http(s) and ws(s) request made from JavaScript. */
export function installNetworkGuard() {
  if (guardOn || __DEV__) return;
  guardOn = true;
  const g = globalThis as Record<string, any>;

  const realFetch = g.fetch;
  if (typeof realFetch === 'function') {
    g.fetch = (input: unknown, init?: unknown) => {
      if (REMOTE.test(urlOf(input))) {
        blocked++;
        return Promise.reject(new TypeError(MESSAGE));
      }
      return realFetch(input, init);
    };
  }

  const XHR = g.XMLHttpRequest;
  if (XHR?.prototype?.open) {
    const open = XHR.prototype.open;
    XHR.prototype.open = function (method: string, url: unknown, ...rest: unknown[]) {
      if (REMOTE.test(urlOf(url))) {
        blocked++;
        throw new Error(MESSAGE);
      }
      return open.call(this, method, url, ...rest);
    };
  }

  for (const name of ['WebSocket', 'EventSource']) {
    if (!g[name]) continue;
    g[name] = function Blocked() {
      blocked++;
      throw new Error(MESSAGE);
    };
  }
}

export type CheckState = 'pass' | 'fail' | 'dev' | 'na';
export type PrivacyCheck = { id: string; title: string; state: CheckState; detail: string };

/** Runs on the device. Sends nothing anywhere. */
export async function runPrivacyChecks(): Promise<PrivacyCheck[]> {
  const checks: PrivacyCheck[] = [];
  const status = DeviceGuard?.networkStatus();

  if (!status) {
    checks.push({
      id: 'os',
      title: 'Android blocks internet for Kharcha',
      state: 'na',
      detail: Platform.OS === 'web' ? 'This is the web preview. The privacy checks run in the Android app.' : 'Needs the Kharcha Android build.',
    });
  } else if (!status.internetPermission && status.socketBlocked) {
    checks.push({ id: 'os', title: 'Android blocks internet for Kharcha', state: 'pass', detail: `The app has no internet permission. A test socket was refused by Android (${status.socketError ?? 'denied'}).` });
  } else if (__DEV__) {
    checks.push({ id: 'os', title: 'Android blocks internet for Kharcha', state: 'dev', detail: 'This is a development build. It keeps internet access only to load code from your computer. The release build removes it.' });
  } else {
    checks.push({ id: 'os', title: 'Android blocks internet for Kharcha', state: 'fail', detail: 'This build can open network sockets. Install the release build.' });
  }

  if (__DEV__) {
    checks.push({ id: 'js', title: 'App code cannot make requests', state: 'dev', detail: 'Turned on in release builds. Development builds need the network for live reload.' });
  } else {
    let refused = false;
    try {
      await fetch('https://example.invalid/kharcha-self-test');
    } catch (e) {
      refused = e instanceof Error && e.message === MESSAGE;
    }
    checks.push({
      id: 'js',
      title: 'App code cannot make requests',
      state: guardOn && refused ? 'pass' : 'fail',
      detail: guardOn && refused ? 'A test request was refused inside the app before it could leave.' : 'The in-app network guard is not active.',
    });
  }

  if (status) {
    checks.push({
      id: 'backup',
      title: 'No copy goes to cloud backup',
      state: status.backupAllowed ? 'fail' : 'pass',
      detail: status.backupAllowed ? 'Android may back up app data to Google Drive.' : 'Android cloud backup and device transfer are turned off for Kharcha.',
    });
  }
  return checks;
}

export const networkGuardActive = () => guardOn;
export const blockedRequests = () => blocked;
