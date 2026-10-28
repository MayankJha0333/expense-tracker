import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Badge, Button, Icon, Txt } from '../components/ui';
import { openAppSettings } from '../lib/sms';
import { useStore } from '../lib/store';
import { cat, type IconName } from '../lib/types';
import { radius, space, usePalette } from '../theme';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'message-text-lock-outline',
    title: 'Only bank, card and UPI alerts',
    body: 'Messages from people are dropped before the app even looks at them.',
  },
  {
    icon: 'shield-check-outline',
    title: 'OTPs and offers are ignored',
    body: 'Codes, promos, bill reminders and failed payments never count as spending.',
  },
  {
    icon: 'cellphone-lock',
    title: 'Stays on this phone',
    body: 'No sign-up, no server. Your messages never leave the device.',
  },
];

export default function Welcome() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { permission, requestAccess, continueWithoutSms, status } = useStore();
  const [asking, setAsking] = useState(false);

  // Once access is given (or you pick manual mode) go to Home.
  useEffect(() => {
    if (status === 'ready' || status === 'loading') router.replace('/');
  }, [status]);

  const onAllow = async () => {
    setAsking(true);
    await requestAccess();
    setAsking(false);
  };

  const food = cat('food');

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, gap: space.xl }}
    >
      <Txt variant="title">Kharcha</Txt>

      {/* What the app does, shown with one example message */}
      <View style={{ gap: space.md }}>
        <View style={[styles.sms, { backgroundColor: p.surface, borderColor: p.line }]}>
          <Txt variant="tiny" color={p.muted}>
            Example bank SMS
          </Txt>
          <Txt variant="small" color={p.inkSoft}>
            Sent Rs.250.00 From HDFC Bank A/C *4521 To SWIGGY On 12/10/26 Ref 6285…
          </Txt>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Icon name="arrow-down" size={20} color={p.marigold} />
        </View>
        <View style={[styles.result, { backgroundColor: p.card }]}>
          <Badge icon={food.icon} color={food.color} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" color={p.cardText}>
              Swiggy
            </Txt>
            <Txt variant="small" color={p.cardMuted}>
              Food & dining, UPI
            </Txt>
          </View>
          <Txt variant="amount" color={p.cardText}>
            ₹250
          </Txt>
        </View>
      </View>

      <Txt variant="title" style={{ fontSize: 30, lineHeight: 36 }}>
        Your spending, sorted from your bank SMS.
      </Txt>

      <View style={{ gap: space.lg }}>
        {POINTS.map((pt) => (
          <View key={pt.title} style={styles.point}>
            <Icon name={pt.icon} size={22} color={p.leaf} />
            <View style={{ flex: 1, gap: 2 }}>
              <Txt variant="bodyStrong">{pt.title}</Txt>
              <Txt variant="small" color={p.muted}>
                {pt.body}
              </Txt>
            </View>
          </View>
        ))}
      </View>

      <View style={{ gap: space.sm }}>
        {permission === 'unavailable' ? (
          <Txt variant="small" color={p.chili}>
            {"This build can't read SMS. Expo Go doesn't include the SMS reader, so install a development build with “npx expo run:android”. You can still add expenses by hand."}
          </Txt>
        ) : permission === 'blocked' ? (
          <>
            <Txt variant="small" color={p.chili}>
              SMS access is turned off for Kharcha. Open Settings, go to Permissions, and allow SMS. Then come back here.
            </Txt>
            <Button label="Open settings" icon="cog-outline" onPress={openAppSettings} />
          </>
        ) : (
          <Button label={asking ? 'Waiting for your answer…' : 'Allow SMS access'} icon="message-processing-outline" onPress={onAllow} disabled={asking} />
        )}
        <Button label="Add expenses by hand instead" kind="quiet" onPress={continueWithoutSms} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sms: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: 4, marginRight: space.xxl },
  result: { borderRadius: radius.md, padding: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, marginLeft: space.xxl },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
});
