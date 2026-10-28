import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { Icon, Txt } from '../components/ui';
import { POLICY, POLICY_SUMMARY, POLICY_UPDATED } from '../lib/policy';
import { radius, space, usePalette } from '../theme';

export default function PrivacyPolicy() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <ScreenHeader />
      <View style={{ gap: space.xs }}>
        <Txt variant="title" accessibilityRole="header">
          Privacy policy
        </Txt>
        <Txt variant="small" color={p.muted}>
          Last updated {POLICY_UPDATED}
        </Txt>
      </View>

      <View style={[styles.summary, { backgroundColor: p.incomeSoft }]}>
        <Icon name="shield-lock-outline" size={22} color={p.income} />
        <Txt variant="bodyStrong" style={{ flex: 1 }}>
          {POLICY_SUMMARY}
        </Txt>
      </View>

      {POLICY.map((s) => (
        <View key={s.title} style={{ gap: space.sm }}>
          <Txt variant="heading" accessibilityRole="header">
            {s.title}
          </Txt>
          {s.body.map((para, i) => (
            <Txt key={i} variant="body" color={p.inkSoft} selectable>
              {para}
            </Txt>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md },
});
