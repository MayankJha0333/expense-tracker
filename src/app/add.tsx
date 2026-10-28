import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { Button, Chip, Segmented, Txt } from '../components/ui';
import { categoryFromMerchant } from '../lib/categorize';
import { useStore } from '../lib/store';
import { CREDIT_CATEGORIES, DEBIT_CATEGORIES, type CategoryId, type IconName, type PayMode, type TxnType } from '../lib/types';
import { fonts, radius, space, usePalette } from '../theme';

const DAYS = [
  { label: 'Today', back: 0 },
  { label: 'Yesterday', back: 1 },
  { label: '2 days ago', back: 2 },
  { label: '3 days ago', back: 3 },
];

const PAY_WITH: { id: PayMode; label: string; icon: IconName }[] = [
  { id: 'cash', label: 'Cash', icon: 'cash' },
  { id: 'upi', label: 'UPI', icon: 'cellphone' },
  { id: 'card', label: 'Card', icon: 'credit-card-outline' },
];

const SPEND_CATEGORIES = DEBIT_CATEGORIES.filter((c) => c.countsAsSpend || c.isSaving);
const INCOME_CATEGORIES = CREDIT_CATEGORIES.filter((c) => c.isIncome);

/** Add what the bank never sees: cash spends (chai, auto, sabzi) and cash income. */
export default function AddEntry() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { addEntry } = useStore();
  const [kind, setKind] = useState<TxnType>('debit');
  const [amountText, setAmountText] = useState('');
  const [what, setWhat] = useState('');
  const [category, setCategory] = useState<CategoryId>('food');
  const [picked, setPicked] = useState(false);
  const [daysBack, setDaysBack] = useState(0);
  const [mode, setMode] = useState<PayMode>('cash');

  const amount = parseFloat(amountText.replace(/,/g, ''));
  const valid = Number.isFinite(amount) && amount > 0;
  const income = kind === 'credit';

  const switchKind = (k: TxnType) => {
    setKind(k);
    setPicked(false);
    setCategory(k === 'credit' ? 'received' : 'food');
    if (k === 'credit' && mode === 'card') setMode('cash');
  };

  const onWhat = (text: string) => {
    setWhat(text);
    // Guess the category from the name until you pick one yourself.
    if (!picked && !income) {
      const guess = categoryFromMerchant(text);
      if (guess && guess !== 'card_bill') setCategory(guess);
    }
  };

  const save = () => {
    if (!valid) return;
    const when = new Date();
    when.setDate(when.getDate() - daysBack);
    addEntry({ type: kind, amount, merchant: what, category, timestamp: when.getTime(), mode });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
      >
        <ScreenHeader close title={income ? 'Add income' : 'Add expense'} />

        <Segmented
          value={kind}
          onChange={switchKind}
          options={[
            { id: 'debit', label: 'Expense' },
            { id: 'credit', label: 'Income' },
          ]}
        />

        <View style={styles.amountRow}>
          <Txt variant="display" color={valid ? (income ? p.income : p.ink) : p.muted}>
            {income ? '+₹' : '₹'}
          </Txt>
          <TextInput
            value={amountText}
            onChangeText={(t) => setAmountText(t.replace(/[^0-9.,]/g, ''))}
            placeholder="0"
            placeholderTextColor={p.muted}
            keyboardType="decimal-pad"
            autoFocus
            style={[styles.amountInput, { color: income ? p.income : p.ink }]}
            accessibilityLabel="Amount in rupees"
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="smallStrong" color={p.inkSoft}>
            {income ? 'Where did it come from?' : 'What was it for?'}
          </Txt>
          <TextInput
            value={what}
            onChangeText={onWhat}
            placeholder={income ? 'Freelance work, gift, rent from tenant…' : 'Chai, auto, vegetables…'}
            placeholderTextColor={p.muted}
            style={[styles.textInput, { color: p.ink, backgroundColor: p.surface, borderColor: p.line }]}
          />
        </View>

        <View style={{ gap: space.sm }}>
          <Txt variant="smallStrong" color={p.inkSoft}>
            {income ? 'Received as' : 'Paid with'}
          </Txt>
          <View style={styles.wrap}>
            {PAY_WITH.filter((m) => !income || m.id !== 'card').map((m) => (
              <Chip key={m.id} label={m.label} icon={m.icon} selected={mode === m.id} onPress={() => setMode(m.id)} />
            ))}
          </View>
          {mode !== 'cash' ? (
            <Txt variant="tiny" color={p.muted}>
              Only add UPI or card payments your bank didn&apos;t send an SMS for, or they&apos;ll be counted twice.
            </Txt>
          ) : null}
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
            {(income ? INCOME_CATEGORIES : SPEND_CATEGORIES).map((c) => (
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

        <Button label={income ? 'Save income' : 'Save expense'} icon="check" kind={income ? 'primary' : 'accent'} onPress={save} disabled={!valid} />
        <Txt variant="small" color={p.muted} style={{ textAlign: 'center' }}>
          Saved only on this phone.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, overflow: 'hidden' },
  amountInput: { flex: 1, minWidth: 0, width: '100%', fontFamily: fonts.number, fontSize: 40, paddingVertical: 0 },
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
