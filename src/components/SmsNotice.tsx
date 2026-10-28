import { Platform, StyleSheet, View } from 'react-native';

import { openAppSettings, sideloadRestricted, type SmsPermission } from '../lib/sms';
import { useStore } from '../lib/store';
import { radius, space, usePalette } from '../theme';
import { Button, Icon, Txt } from './ui';

/** Numbered steps for turning SMS access back on in Android Settings. */
export function SettingsSteps({ restricted }: { restricted: boolean }) {
  const p = usePalette();
  const steps = restricted
    ? [
        'Tap "Open App info" below.',
        'Tap ⋮ in the top corner, then "Allow restricted settings". Confirm with your PIN or fingerprint.',
        'Go back, open Permissions → SMS, and choose Allow.',
      ]
    : ['Tap "Open App info" below.', 'Open Permissions → SMS.', 'Choose Allow, then come back here.'];
  return (
    <View style={{ gap: space.sm }}>
      {steps.map((s, i) => (
        <View key={i} style={styles.step}>
          <View style={[styles.num, { backgroundColor: p.ink }]}>
            <Txt variant="tiny" color={p.bg}>
              {i + 1}
            </Txt>
          </View>
          <Txt variant="small" color={p.inkSoft} style={{ flex: 1 }}>
            {s}
          </Txt>
        </View>
      ))}
    </View>
  );
}

export function smsCopy(permission: SmsPermission): { title: string; body: string } {
  switch (permission) {
    case 'unavailable':
      return {
        title: 'SMS reading is not in this build',
        body:
          Platform.OS === 'android'
            ? 'Expo Go does not include the SMS reader. Install the Kharcha app build to read bank SMS. You can still add entries by hand.'
            : 'Reading bank SMS works only on Android. You can still add entries by hand.',
      };
    case 'restricted':
      return {
        title: 'Android is holding back SMS access',
        body:
          'Kharcha was installed from a downloaded file, so Android 15 and later keep SMS access locked until you allow it. This is an Android safety rule, not an error.',
      };
    case 'blocked':
      return {
        title: 'SMS access is turned off',
        body: 'Android will not ask again, so turn it on in Settings. If Android shows "Restricted setting", use ⋮ → Allow restricted settings first.',
      };
    default:
      return { title: 'Bank SMS reading is off', body: 'Turn it on to track UPI, card and ATM payments on their own. Messages are read on this phone only.' };
  }
}

/** Shown on Home when transactions could come from SMS but can't right now. */
export function SmsNotice() {
  const p = usePalette();
  const { permission, source, requestAccess } = useStore();
  if (permission === 'granted' || source === 'demo') return null;
  // Manual mode in a build without the reader: nothing useful to offer.
  if (source === 'manual' && permission === 'unavailable') return null;

  const restricted = permission === 'restricted' || (permission === 'blocked' && sideloadRestricted());
  const { title, body } = smsCopy(restricted ? 'restricted' : permission);
  const needsSettings = permission === 'blocked' || permission === 'restricted';

  return (
    <View style={[styles.box, { backgroundColor: p.accentSoft }]}>
      <View style={styles.head}>
        <Icon name="message-processing-outline" size={20} color={p.accentInk} />
        <Txt variant="bodyStrong" style={{ flex: 1 }}>
          {title}
        </Txt>
      </View>
      <Txt variant="small" color={p.inkSoft}>
        {source === 'manual' && permission === 'denied' ? `You are adding entries by hand. ${body}` : body}
      </Txt>
      {needsSettings ? <SettingsSteps restricted={restricted} /> : null}
      {permission !== 'unavailable' ? (
        <View style={{ alignItems: 'flex-start' }}>
          <Button
            compact
            label={needsSettings ? 'Open App info' : 'Turn on'}
            icon={needsSettings ? 'cog-outline' : 'message-text-outline'}
            onPress={needsSettings ? openAppSettings : requestAccess}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  num: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
});
