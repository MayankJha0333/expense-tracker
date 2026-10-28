import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  FadeInUp,
  FadeOut,
  FadeOutUp,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeroCard } from '../components/HeroCard';
import { Wordmark } from '../components/Logo';
import { enterUp } from '../components/motion';
import { useAskForSms } from '../components/SmsConsent';
import { SettingsSteps, smsCopy } from '../components/SmsNotice';
import { Badge, Button, Icon, Txt } from '../components/ui';
import { SAMPLE_DATA_ENABLED } from '../lib/demo';
import { MOTION } from '../lib/motion';
import { openAppSettings, sideloadRestricted, smsSupported } from '../lib/sms';
import { useStore } from '../lib/store';
import { cat, type CategoryId, type IconName } from '../lib/types';
import { radius, space, usePalette } from '../theme';

/* ---------- The example on the card: a bank SMS turns into a sorted payment ---------- */

type Example = { from: string; sms: string; shop: string; how: string; category: CategoryId; amount: string; income?: boolean };

// The example follows the phone's region: US card alerts in dollars, or Indian bank SMS in rupees.
const EXAMPLES_IN: Example[] = [
  { from: 'HDFC Bank', sms: 'Sent Rs.250.00 from HDFC Bank A/C *4521 to SWIGGY on 12/10/26. Ref 6285…', shop: 'Swiggy', how: 'Food & dining · UPI', category: 'food', amount: '−₹250' },
  { from: 'SBI Card', sms: 'Rs.1,499.00 spent on your SBI Credit Card ending 7788 at AMAZON on 14/10/26…', shop: 'Amazon', how: 'Shopping · Card', category: 'shopping', amount: '−₹1,499' },
  { from: 'HDFC Bank', sms: 'Your A/C XX4521 is credited with Rs.98,000.00 on 01/10/26 by NEFT from ACME TECH…', shop: 'Acme Tech', how: 'Salary · NEFT', category: 'salary', amount: '+₹98,000', income: true },
];
const EXAMPLES_US: Example[] = [
  { from: 'Chase', sms: 'Chase: A $12.50 transaction was made on your card ending in 4417 at CHIPOTLE on 10/12/26…', shop: 'Chipotle', how: 'Food & dining · Card', category: 'food', amount: '−$12.50' },
  { from: 'Citi', sms: 'Citi Alert: A $18.40 transaction was made at UBER TRIP on your card ending in 2203…', shop: 'Uber', how: 'Transport · Card', category: 'transport', amount: '−$18.40' },
  { from: 'Chase', sms: 'Chase: Your direct deposit of $3,250.00 from ACME CORP has posted to your account…', shop: 'Acme Corp', how: 'Salary · Deposit', category: 'salary', amount: '+$3,250', income: true },
];

/** How long each example stays before the next one plays. */
const CYCLE_MS = 3400;

const TRUST: { icon: IconName; label: string }[] = [
  { icon: 'cellphone-lock', label: 'Stays on\nyour phone' },
  { icon: 'message-lock-outline', label: 'Bank alerts\nonly' },
  { icon: 'account-off-outline', label: 'No\nsign-up' },
];

/* ---------- Motion ---------- */

const logoIn = ZoomIn.springify().damping(14).stiffness(180).reduceMotion(ReduceMotion.System);
const smsIn = FadeInDown.duration(MOTION.base)
  .easing(Easing.out(Easing.cubic))
  .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })
  .reduceMotion(ReduceMotion.System);
const smsOut = FadeOutUp.duration(MOTION.fast).reduceMotion(ReduceMotion.System);
// The sorted payment rises in a beat after the SMS, as if Kharcha just read it.
const resultIn = FadeInUp.delay(480).springify().damping(16).stiffness(190).reduceMotion(ReduceMotion.System);
const resultOut = FadeOut.duration(MOTION.fast).reduceMotion(ReduceMotion.System);
const footerIn = FadeInUp.delay(420).duration(MOTION.base).easing(Easing.out(Easing.cubic)).reduceMotion(ReduceMotion.System);
const dotMove = LinearTransition.springify().damping(18).stiffness(220).reduceMotion(ReduceMotion.System);

/** "#RRGGBB" → the same colour fully see-through, for the fade above the buttons. */
const clear = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}00` : 'transparent');

export default function Welcome() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const { permission, chooseSource, status, currency } = useStore();
  const askForSms = useAskForSms();
  const [asking, setAsking] = useState(false);
  const [footerH, setFooterH] = useState(180);

  // Once data is ready (SMS allowed, sample or manual chosen) go to Home.
  useEffect(() => {
    if (status === 'ready' || status === 'loading') router.replace('/');
  }, [status]);

  // Play the examples one after another. With "Reduce motion" on, the first one stays.
  const examples = currency === 'USD' ? EXAMPLES_US : EXAMPLES_IN;
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const t = setInterval(() => setStep((s) => (s + 1) % examples.length), CYCLE_MS);
    return () => clearInterval(t);
  }, [reduced, examples.length]);
  const ex = examples[step % examples.length];

  const onAllow = async () => {
    setAsking(true);
    await askForSms();
    setAsking(false);
  };

  const unavailable = permission === 'unavailable' || !smsSupported;
  const needsSettings = !unavailable && (permission === 'blocked' || permission === 'restricted');
  const restricted = permission === 'restricted' || (permission === 'blocked' && sideloadRestricted());
  const manual = () => chooseSource('manual');

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: space.xl, paddingTop: insets.top + space.md, paddingBottom: footerH + space.lg, gap: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={logoIn} style={{ alignSelf: 'flex-start' }}>
          <Wordmark size={34} />
        </Animated.View>

        <View style={{ gap: space.sm }}>
          <Animated.View entering={enterUp(1)}>
            <Txt variant="display" style={styles.headline} accessibilityRole="header">
              Know where your{'\n'}
              <Txt variant="display" style={styles.headline} color={p.accentInk}>
                money goes.
              </Txt>
            </Txt>
          </Animated.View>
          <Animated.View entering={enterUp(2)}>
            <Txt variant="body" color={p.inkSoft}>
              Kharcha reads your bank SMS and sorts every payment for you, right on this phone.
            </Txt>
          </Animated.View>
        </View>

        <Animated.View entering={enterUp(3)}>
          <HeroCard accessibilityLabel={`Example. A bank SMS becomes a payment: ${ex.shop}, ${ex.how}, ${ex.amount}.`}>
            <Txt variant="smallStrong" color={p.heroMuted}>
              How it works
            </Txt>

            {/* 1. The bank SMS */}
            <View style={styles.smsSlot}>
              <Animated.View key={`sms-${currency}-${step}`} entering={smsIn} exiting={smsOut} style={[styles.bubble, { backgroundColor: p.heroTile }]}>
                <View style={styles.bubbleHead}>
                  <Icon name="message-text-outline" size={14} color={p.heroMuted} />
                  <Txt variant="tiny" color={p.heroMuted}>
                    SMS from {ex.from}
                  </Txt>
                </View>
                <Txt variant="small" color={p.heroText} numberOfLines={3}>
                  {ex.sms}
                </Txt>
              </Animated.View>
            </View>

            {/* 2. Kharcha reads it */}
            <ReadingArrow />

            {/* 3. The sorted payment */}
            <View style={styles.resultSlot}>
              <Animated.View
                key={`res-${currency}-${step}`}
                entering={resultIn}
                exiting={resultOut}
                style={[styles.result, { backgroundColor: p.surface, boxShadow: p.shadowCard }]}
              >
                <Badge icon={cat(ex.category).icon} color={cat(ex.category).color} size={38} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Txt variant="bodyStrong" numberOfLines={1}>
                    {ex.shop}
                  </Txt>
                  <Txt variant="small" color={p.muted} numberOfLines={1}>
                    {ex.how}
                  </Txt>
                </View>
                <Txt variant="amount" tabular color={ex.income ? p.income : p.ink}>
                  {ex.amount}
                </Txt>
              </Animated.View>
            </View>

            <View style={styles.dots} accessible={false} importantForAccessibility="no-hide-descendants">
              {examples.map((e, i) => (
                <Animated.View
                  key={e.shop}
                  layout={dotMove}
                  style={[styles.dot, { width: i === step ? 18 : 6, backgroundColor: i === step ? p.heroText : p.heroTrack }]}
                />
              ))}
            </View>
          </HeroCard>
        </Animated.View>

        {/* Why SMS can't reach Kharcha, and how to fix it */}
        {unavailable ? (
          <Animated.View entering={enterUp(4)} style={[styles.note, { backgroundColor: p.surfaceAlt }]}>
            <Txt variant="small" color={p.inkSoft}>
              {smsCopy('unavailable').body}
            </Txt>
          </Animated.View>
        ) : needsSettings ? (
          <Animated.View entering={enterUp(4)} style={[styles.note, { backgroundColor: p.accentSoft, gap: space.md }]}>
            <Txt variant="bodyStrong">{smsCopy(restricted ? 'restricted' : 'blocked').title}</Txt>
            <Txt variant="small" color={p.inkSoft}>
              {smsCopy(restricted ? 'restricted' : 'blocked').body}
            </Txt>
            <SettingsSteps restricted={restricted} />
          </Animated.View>
        ) : null}

        <View style={styles.trustRow}>
          {TRUST.map((t, i) => (
            <Animated.View key={t.icon} entering={enterUp(4 + i)} style={[styles.trust, { backgroundColor: p.surface, borderColor: p.line }]}>
              <View style={[styles.trustIcon, { backgroundColor: p.incomeSoft }]}>
                <Icon name={t.icon} size={16} color={p.income} />
              </View>
              <Txt variant="tiny" style={{ flex: 1 }} numberOfLines={2}>
                {t.label}
              </Txt>
            </Animated.View>
          ))}
        </View>
      </ScrollView>

      {/* The choices stay pinned at the bottom, so they never need a scroll to find. */}
      <Animated.View
        entering={footerIn}
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        style={[styles.footer, { backgroundColor: p.bg, paddingBottom: insets.bottom + space.md }]}
      >
        <View pointerEvents="none" style={[styles.fade, { backgroundImage: `linear-gradient(to bottom, ${clear(p.bg)}, ${p.bg})` }]} />
        {unavailable ? (
          <Button label="Add entries by hand" icon="pencil-outline" onPress={manual} />
        ) : (
          <>
            {needsSettings ? (
              <Button label="Open App info" icon="cog-outline" onPress={openAppSettings} />
            ) : (
              <Button label={asking ? 'Waiting for your answer…' : 'Allow SMS access'} icon="message-processing-outline" onPress={onAllow} disabled={asking} />
            )}
            {!needsSettings ? (
              <Txt variant="tiny" color={p.muted} style={{ textAlign: 'center' }}>
                Android will ask you first. You can turn it off any time.
              </Txt>
            ) : null}
            {SAMPLE_DATA_ENABLED ? <Button label="Explore with sample data" kind="secondary" icon="flask-outline" onPress={() => chooseSource('demo')} /> : null}
            <Button label="Add entries by hand instead" kind="quiet" onPress={manual} />
          </>
        )}
        <Pressable onPress={() => router.push('/privacy')} accessibilityRole="link" hitSlop={8} style={styles.policy}>
          <Icon name="shield-lock-outline" size={14} color={p.muted} />
          <Txt variant="tiny" color={p.muted} style={{ textDecorationLine: 'underline' }}>
            Read the privacy policy
          </Txt>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/** A small arrow between the SMS and the payment that nudges down, as if Kharcha is reading. */
function ReadingArrow() {
  const p = usePalette();
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.set(withRepeat(withSequence(withTiming(4, { duration: 520, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 520, easing: Easing.inOut(Easing.quad) })), -1));
    return () => cancelAnimation(y);
  }, [reduced, y]);
  const nudge = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  return (
    <View style={styles.reading}>
      <Animated.View style={nudge}>
        <Icon name="arrow-down" size={16} color={p.heroText} />
      </Animated.View>
      <Txt variant="tiny" color={p.heroMuted}>
        Kharcha sorts it for you
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { fontSize: 34, lineHeight: 40 },
  smsSlot: { minHeight: 90 },
  bubble: { borderRadius: radius.md, borderTopLeftRadius: 6, padding: space.md, gap: 4, marginRight: space.lg },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  resultSlot: { minHeight: 66 },
  result: { borderRadius: radius.md, paddingVertical: space.md, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md, marginLeft: space.sm },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 2 },
  dot: { height: 6, borderRadius: 3 },
  note: { borderRadius: radius.md, padding: space.lg },
  trustRow: { flexDirection: 'row', gap: space.sm },
  trust: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: space.sm, paddingHorizontal: space.sm, borderRadius: radius.sm, borderWidth: StyleSheet.hairlineWidth },
  trustIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: space.xl, paddingTop: space.sm, gap: space.sm },
  fade: { position: 'absolute', left: 0, right: 0, top: -28, height: 28 },
  policy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 32 },
});
