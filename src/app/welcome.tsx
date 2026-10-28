import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SettingsSteps, smsCopy } from '../components/SmsNotice';
import { LogoTile } from '../components/Logo';
import { Badge, Button, Icon, Txt } from '../components/ui';
import { Stagger } from '../components/motion';
import { openAppSettings, sideloadRestricted, smsSupported } from '../lib/sms';
import { useStore } from '../lib/store';
import { cat, type IconName } from '../lib/types';
import { radius, space, usePalette } from '../theme';

const POINTS: { icon: IconName; title: string; body: string }[] = [
  { icon: 'cloud-off-outline', title: 'Nothing is uploaded', body: 'No account and no server. Your payments are read and added up on this phone.' },
  { icon: 'message-lock-outline', title: 'Only bank, card and UPI alerts', body: 'Chats from people are dropped before the app reads them. OTPs and offers are ignored.' },
  { icon: 'cellphone-lock', title: 'Stays on this phone', body: 'No account, no server, no cloud backup. Delete everything with one tap.' },
];

export default function Welcome() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { permission, requestAccess, chooseSource, status, currency } = useStore();
  const [asking, setAsking] = useState(false);

  // Once data is ready (SMS allowed, sample or manual chosen) go to Home.
  useEffect(() => {
    if (status === 'ready' || status === 'loading') router.replace('/');
  }, [status]);

  const onAllow = async () => {
    setAsking(true);
    await requestAccess();
    setAsking(false);
  };

  const food = cat('food');
  const salary = cat('salary');
  const needsSettings = permission === 'blocked' || permission === 'restricted';
  const restricted = permission === 'restricted' || (permission === 'blocked' && sideloadRestricted());
  // The example follows the phone's region: a US card alert in dollars, or an Indian UPI SMS in rupees.
  const ex =
    currency === 'USD'
      ? { sms: 'Chase: A $12.50 transaction was made on your card ending in 4417 at CHIPOTLE on 10/12/26…', shop: 'Chipotle', how: 'Food & dining · Card', spent: '$12.50', pay: 'Salary · Direct deposit', income: '+$3,250' }
      : { sms: 'Sent Rs.250.00 From HDFC Bank A/C *4521 To SWIGGY On 12/10/26 Ref 6285…', shop: 'Swiggy', how: 'Food & dining · UPI', spent: '₹250', pay: 'Salary · NEFT', income: '+₹98,000' };

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ padding: space.xl, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl, gap: space.xl }}
    >
      <Stagger>
      <View style={{ gap: space.lg }}>
        <LogoTile size={64} />
        <Txt variant="title" style={{ fontSize: 32, lineHeight: 38 }} accessibilityRole="header">
          Know where your money goes.{'\n'}
          <Txt variant="title" style={{ fontSize: 32, lineHeight: 38 }} color={p.accentInk}>
            It never leaves your phone.
          </Txt>
        </Txt>
        <Txt variant="body" color={p.inkSoft}>
          Kharcha turns your bank SMS into a clear picture of what you earn, spend and save.
        </Txt>
      </View>

      {/* What the app does, shown with one example message */}
      <View style={{ gap: space.sm }}>
        <View style={[styles.sms, { backgroundColor: p.surface, borderColor: p.line }]}>
          <Txt variant="tiny" color={p.muted}>
            Bank SMS
          </Txt>
          <Txt variant="small" color={p.inkSoft}>
            {ex.sms}
          </Txt>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Icon name="arrow-down" size={18} color={p.accent} />
        </View>
        <View style={[styles.result, { backgroundColor: p.card }]}>
          <Badge icon={food.icon} color={food.color} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" color={p.cardText}>
              {ex.shop}
            </Txt>
            <Txt variant="small" color={p.cardMuted}>
              {ex.how}
            </Txt>
          </View>
          <Txt variant="amount" color={p.cardText}>
            {ex.spent}
          </Txt>
        </View>
        <View style={[styles.result, { backgroundColor: p.card, marginTop: -2 }]}>
          <Badge icon={salary.icon} color={p.cardIncome} />
          <View style={{ flex: 1 }}>
            <Txt variant="bodyStrong" color={p.cardText}>
              Acme
            </Txt>
            <Txt variant="small" color={p.cardMuted}>
              {ex.pay}
            </Txt>
          </View>
          <Txt variant="amount" color={p.cardIncome}>
            {ex.income}
          </Txt>
        </View>
      </View>

      <View style={{ gap: space.lg }}>
        {POINTS.map((pt) => (
          <View key={pt.title} style={styles.point}>
            <View style={[styles.pointIcon, { backgroundColor: p.incomeSoft }]}>
              <Icon name={pt.icon} size={20} color={p.income} />
            </View>
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
        {permission === 'unavailable' || !smsSupported ? (
          <View style={[styles.note, { backgroundColor: p.surfaceAlt }]}>
            <Txt variant="small" color={p.inkSoft}>
              {smsCopy('unavailable').body}
            </Txt>
          </View>
        ) : needsSettings ? (
          <View style={[styles.note, { backgroundColor: p.accentSoft, gap: space.md }]}>
            <Txt variant="bodyStrong">{smsCopy(restricted ? 'restricted' : 'blocked').title}</Txt>
            <Txt variant="small" color={p.inkSoft}>
              {smsCopy(restricted ? 'restricted' : 'blocked').body}
            </Txt>
            <SettingsSteps restricted={restricted} />
            <Button label="Open App info" icon="cog-outline" onPress={openAppSettings} />
          </View>
        ) : (
          <Button label={asking ? 'Waiting for your answer…' : 'Allow SMS access'} icon="message-processing-outline" onPress={onAllow} disabled={asking} />
        )}
        <Button label="Explore with sample data" kind="secondary" icon="flask-outline" onPress={() => chooseSource('demo')} />
        <Button label="Add entries by hand instead" kind="quiet" onPress={() => chooseSource('manual')} />
      </View>

      <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link" hitSlop={8} style={styles.policy}>
        <Icon name="file-document-outline" size={16} color={p.muted} />
        <Txt variant="smallStrong" color={p.muted} style={{ textDecorationLine: 'underline' }}>
          Read the privacy policy
        </Txt>
      </Pressable>
      </Stagger>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sms: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: 4, marginRight: space.xxl },
  result: { borderRadius: radius.md, padding: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', gap: space.md, marginLeft: space.xxl },
  point: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pointIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  note: { borderRadius: radius.md, padding: space.lg },
  policy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44 },
});
