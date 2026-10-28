import { router } from 'expo-router';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOTION } from '../lib/motion';
import type { SmsPermission } from '../lib/sms';
import { useStore } from '../lib/store';
import type { IconName } from '../lib/types';
import { radius, space, usePalette } from '../theme';
import { Button, Icon, Txt } from './ui';

/*
 * Google Play's "prominent disclosure": before Android's own SMS permission popup, Kharcha
 * says in plain words why it needs SMS, what it reads and how it is used, and asks for a
 * clear yes or no. Every "turn on SMS" button goes through askForSms(), never straight to
 * the Android popup. Keep this text in line with the privacy policy (lib/policy.ts).
 */

type Ask = () => Promise<SmsPermission | null>;
const AskContext = createContext<Ask>(async () => null);

/** Shows the disclosure; resolves with the permission result, or null if the person chose "Not now". */
export const useAskForSms = () => useContext(AskContext);

const READS: { icon: IconName; text: string }[] = [
  { icon: 'bank-outline', text: 'Payment alerts from banks, cards, UPI and wallets: the amount, the shop or person, the last digits of the account or card, and the date.' },
  { icon: 'credit-card-clock-outline', text: 'Card bill messages: the amount due and the due date.' },
  { icon: 'message-lock-outline', text: 'Chats from people are dropped before the app reads them. OTPs and offers are ignored.' },
];

const backdropIn = FadeIn.duration(MOTION.fast).reduceMotion(ReduceMotion.System);
const sheetIn = SlideInDown.springify().damping(20).stiffness(200).reduceMotion(ReduceMotion.System);

export function SmsConsentProvider({ children }: { children: ReactNode }) {
  const { requestAccess } = useStore();
  const [open, setOpen] = useState(false);
  const pending = useRef<((result: SmsPermission | null) => void) | null>(null);

  const ask = useCallback<Ask>(
    () =>
      new Promise((resolve) => {
        pending.current?.(null);
        pending.current = resolve;
        setOpen(true);
      }),
    [],
  );

  const settle = (result: SmsPermission | null) => {
    pending.current?.(result);
    pending.current = null;
  };

  const decline = () => {
    setOpen(false);
    settle(null);
  };

  const agree = async () => {
    setOpen(false);
    settle(await requestAccess());
  };

  const readPolicy = () => {
    decline();
    router.push('/privacy');
  };

  return (
    <AskContext.Provider value={ask}>
      {children}
      <Modal visible={open} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={decline}>
        {open ? <Disclosure onAgree={agree} onDecline={decline} onPolicy={readPolicy} /> : null}
      </Modal>
    </AskContext.Provider>
  );
}

function Disclosure({ onAgree, onDecline, onPolicy }: { onAgree: () => void; onDecline: () => void; onPolicy: () => void }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Animated.View entering={backdropIn} style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDecline} accessibilityLabel="Not now" />
      </Animated.View>
      <Animated.View
        entering={sheetIn}
        accessibilityViewIsModal
        style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + space.lg }]}
      >
        <View style={[styles.handle, { backgroundColor: p.line }]} />
        <ScrollView contentContainerStyle={{ gap: space.lg }} bounces={false}>
          <View style={[styles.badge, { backgroundColor: p.accentSoft }]}>
            <Icon name="message-processing-outline" size={26} color={p.accentInk} />
          </View>
          <View style={{ gap: space.sm }}>
            <Txt variant="heading" accessibilityRole="header">
              Let Kharcha read your bank SMS?
            </Txt>
            <Txt variant="body" color={p.inkSoft}>
              Kharcha finds your payments in the SMS your bank sends, so your spending is tracked without typing it in.
            </Txt>
          </View>

          <View style={{ gap: space.md }}>
            <Txt variant="smallStrong">What Kharcha reads</Txt>
            {READS.map((r) => (
              <View key={r.icon} style={styles.row}>
                <Icon name={r.icon} size={18} color={p.accentInk} />
                <Txt variant="small" color={p.inkSoft} style={{ flex: 1 }}>
                  {r.text}
                </Txt>
              </View>
            ))}
          </View>

          <View style={[styles.how, { backgroundColor: p.incomeSoft }]}>
            <Icon name="cellphone-lock" size={18} color={p.income} />
            <Txt variant="small" style={{ flex: 1 }}>
              Everything is worked out on this phone. Kharcha does not upload, share or sell your messages. You can turn this off any time in Android Settings.
            </Txt>
          </View>

          <Pressable onPress={onPolicy} accessibilityRole="link" hitSlop={8} style={styles.policy}>
            <Txt variant="smallStrong" color={p.accentInk} style={{ textDecorationLine: 'underline' }}>
              Read the privacy policy
            </Txt>
          </Pressable>
        </ScrollView>

        <View style={{ gap: space.sm, paddingTop: space.md }}>
          <Button label="Agree and continue" icon="check" onPress={onAgree} />
          <Button label="Not now" kind="quiet" onPress={onDecline} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.xl, paddingTop: space.sm, maxHeight: '92%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: space.lg },
  badge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  how: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', borderRadius: radius.md, padding: space.md },
  policy: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
});
