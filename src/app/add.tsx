import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Chip, Txt } from '../components/ui';
import { categoryFromMerchant } from '../lib/categorize';
import { useStore } from '../lib/store';
import { DEBIT_CATEGORIES, type CategoryId } from '../lib/types';
import { fonts, radius, space, usePalette } from '../theme';

const DAYS = [
  { label: 'Today', back: 0 },
  { label: 'Yesterday', back: 1 },
  { label: '2 days ago', back: 2 },
  { label: '3 days ago', back: 3 },
];

/** Add a cash expense the bank never sees (chai, auto, sabzi). */
export default function AddExpense() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { addManual } = useStore();
  const [amountText, setAmountText] = useState('');
  const [what, setWhat] = useState('');
  const [category, setCategory] = useState<CategoryId>('food');
  const [picked, setPicked] = useState(false);
  const [daysBack, setDaysBack] = useState(0);

  const amount = parseFloat(amountText.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0;

  const onWhat = (text: string) => {
    setWhat(text);
    // Guess the category from the name until you pick one yourself.
    if (!picked) {
      const guess = categoryFromMerchant(text);
      if (guess && guess !== 'card_bill') setCategory(guess);
    }
  };

  const save = () => {
    if (!valid) return;
    const when = new Date();
    when.setDate(when.getDate() - daysBack);
    addManual({ amount, merchant: what, category, timestamp: when.getTime() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
      >
        <ScreenHeader close title="Add cash expense" />

        <View style={styles.amountRow}>
          <Txt variant="display" color={valid ? p.ink : p.muted}>
            ₹
          </Txt>
          <TextInput
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            placeholderTextColor={p.muted}
            keyboardType="decimal-pad"
            autoFocus
            style={[styles.amountInput, { color: p.ink }]}
            accessibilityLabel="Amount in rupees"
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="smallStrong" color={p.inkSoft}>
            What was it for?
          </Txt>
          <TextInput
            value={what}
            onChangeText={onWhat}
            placeholder="Chai, auto, vegetables…"
            placeholderTextColor={p.muted}
            style={[styles.textInput, { color: p.ink, backgroundColor: p.surface, borderColor: p.line }]}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="smallStrong" color={p.inkSoft}>
            When
          </Txt>
          <View style={styles.wrap}>
            {DAYS.map((d) => (
              <Chip key={d.back} label={d.label} selected={daysBack === d.back} onPress={() => setDaysBack(d.back)} />
            ))}
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="smallStrong" color={p.inkSoft}>
            Category
          </Txt>
          <View style={styles.wrap}>
            {DEBIT_CATEGORIES.filter((c) => c.countsAsSpend).map((c) => (
              <Chip
                key={c.id}
                label={c.label}
                icon={c.icon}
                color={c.color}
                selected={category === c.id}
                onPress={() => {
                  setPicked(true);
                  setCategory(c.id);
                }}
              />
            ))}
          </View>
        </View>

        <Button label="Save expense" icon="check" onPress={save} disabled={!valid} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  amountInput: { flex: 1, fontFamily: fonts.serif, fontSize: 46, paddingVertical: 0 },
  textInput: {
    fontFamily: fonts.regular,
    fontSize: 16,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.lg,
    height: 52,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
