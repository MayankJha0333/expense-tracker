import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Chip, Txt } from '../components/ui';
import { addMonths, cashflow, thisMonth } from '../lib/analytics';
import { currencySymbol, money } from '../lib/money';
import { useStore } from '../lib/store';
import { fonts, space, usePalette } from '../theme';

const roundTo = (v: number, step: number) => Math.max(step, Math.round(v / step) * step);

export default function BudgetScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { budget, setBudget, txns } = useStore();
  const [text, setText] = useState(budget ? String(budget) : '');

  // Suggest from the last three full months, not the one still going.
  const usual = useMemo(() => {
    const months = cashflow(txns, addMonths(thisMonth(), -1), 3).filter((m) => m.spent > 0);
    return months.length ? months.reduce((a, m) => a + m.spent, 0) / months.length : 0;
  }, [txns]);
  const suggestions = usual > 0 ? [roundTo(usual * 0.9, 1000), roundTo(usual, 1000), roundTo(usual * 1.1, 1000)] : [20000, 40000, 60000];

  const amount = parseFloat(text.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0;

  const save = () => {
    if (!valid) return;
    setBudget(amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
      >
        <ScreenHeader close title="Monthly budget" />
        <Txt variant="body" color={p.inkSoft}>
          How much do you want to spend in a month? Investments and money between your own accounts are not counted.
        </Txt>

        <View style={styles.amountRow}>
          <Txt variant="display" color={valid ? p.ink : p.muted}>
            {currencySymbol()}
          </Txt>
          <TextInput
            value={text}
            onChangeText={(t) => setText(t.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            placeholderTextColor={p.muted}
            keyboardType="decimal-pad"
            autoFocus
            style={[styles.amountInput, { color: p.ink }]}
            accessibilityLabel="Monthly budget in rupees"
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="smallStrong" color={p.inkSoft}>
            {usual > 0 ? `You usually spend about ${money(usual)} a month` : 'Pick a starting point'}
          </Txt>
          <View style={styles.wrap}>
            {suggestions.map((s) => (
              <Chip key={s} label={money(s)} selected={amount === s} onPress={() => setText(String(s))} />
            ))}
          </View>
        </View>

        <Button label="Save budget" icon="check" onPress={save} disabled={!valid} />
        {budget ? (
          <Button
            label="Remove budget"
            kind="quiet"
            onPress={() => {
              setBudget(null);
              router.back();
            }}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  amountInput: { flex: 1, minWidth: 0, width: '100%', fontFamily: fonts.number, fontSize: 40, paddingVertical: 0 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
