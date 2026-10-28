import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { Badge, Button, Card, Chip, Txt } from '../components/ui';
import { goalPlan } from '../lib/goals';
import { inr } from '../lib/money';
import { useStore } from '../lib/store';
import type { IconName } from '../lib/types';
import { fonts, radius, space, usePalette } from '../theme';

const ICONS: IconName[] = ['shield-check-outline', 'palm-tree', 'laptop', 'home-outline', 'car-outline', 'school-outline', 'ring', 'gift-outline'];
const COLORS = ['#1F8A63', '#E8912A', '#2F7C9E', '#C75B9B', '#7A6FD6', '#C9483B'];
const DEADLINES = [
  { label: 'No date', months: 0 },
  { label: '3 months', months: 3 },
  { label: '6 months', months: 6 },
  { label: '1 year', months: 12 },
  { label: '2 years', months: 24 },
];

const parseAmount = (t: string) => {
  const n = parseFloat(t.replace(/,/g, ''));
  return Number.isFinite(n) ? n : NaN;
};
const monthsFromNow = (m: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + m, 1);
  return d.getTime();
};

/** Create a goal, or (with ?id=) add money to it and edit it. */
export default function GoalScreen() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { goals, saveGoal, addToGoal, deleteGoal } = useStore();
  const existing = id ? goals.find((g) => g.id === id) : undefined;

  const [name, setName] = useState(existing?.name ?? '');
  const [targetText, setTargetText] = useState(existing ? String(existing.target) : '');
  const [savedText, setSavedText] = useState(existing ? String(existing.saved) : '');
  const [icon, setIcon] = useState<IconName>(existing?.icon ?? ICONS[0]);
  const [color, setColor] = useState(existing?.color ?? COLORS[0]);
  const [deadline, setDeadline] = useState<number | null>(existing?.deadline ?? null);
  const [months, setMonths] = useState<number | null>(existing ? null : 0);
  const [moveText, setMoveText] = useState('');

  const target = parseAmount(targetText);
  const saved = savedText.trim() ? parseAmount(savedText) : 0;
  const valid = name.trim().length > 0 && target > 0 && saved >= 0;
  const move = parseAmount(moveText);

  const save = () => {
    if (!valid) return;
    const finalDeadline = months === null ? deadline : months === 0 ? null : monthsFromNow(months);
    saveGoal({ name: name.trim(), target, saved, icon, color, deadline: finalDeadline }, existing?.id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    router.back();
  };

  const moveMoney = (sign: 1 | -1) => {
    if (!existing || !(move > 0)) return;
    addToGoal(existing.id, sign * move);
    setSavedText(String(Math.max(0, existing.saved + sign * move)));
    setMoveText('');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert('Delete this goal?', `"${existing.name}" will be removed. Your transactions are not affected.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteGoal(existing.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
      >
        <ScreenHeader close title={existing ? existing.name : 'New goal'} />

        {existing ? (
          <Card style={{ gap: space.md }}>
            <View style={styles.row}>
              <Badge icon={existing.icon} color={existing.color} size={44} />
              <View style={{ flex: 1 }}>
                <Txt variant="amount" tabular>
                  {inr(existing.saved)}
                </Txt>
                <Txt variant="small" color={p.muted}>
                  {goalPlan(existing)}
                </Txt>
              </View>
            </View>
            <Txt variant="smallStrong" color={p.inkSoft}>
              Put money aside
            </Txt>
            <TextInput
              value={moveText}
              onChangeText={(t) => setMoveText(t.replace(/[^0-9.,]/g, ''))}
              placeholder="Amount, e.g. 5000"
              placeholderTextColor={p.muted}
              keyboardType="decimal-pad"
              style={[styles.input, { color: p.ink, backgroundColor: p.bg, borderColor: p.line }]}
              accessibilityLabel="Amount to add or take out"
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button label="Add" icon="plus" kind="accent" compact onPress={() => moveMoney(1)} disabled={!(move > 0)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button label="Take out" icon="minus" kind="secondary" compact onPress={() => moveMoney(-1)} disabled={!(move > 0)} />
              </View>
            </View>
          </Card>
        ) : null}

        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Emergency fund, Goa trip…"
            placeholderTextColor={p.muted}
            style={[styles.input, { color: p.ink, backgroundColor: p.surface, borderColor: p.line }]}
          />
        </Field>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Field label="Target (₹)">
              <TextInput
                value={targetText}
                onChangeText={(t) => setTargetText(t.replace(/[^0-9.,]/g, ''))}
                placeholder="50000"
                placeholderTextColor={p.muted}
                keyboardType="decimal-pad"
                style={[styles.input, styles.amount, { color: p.ink, backgroundColor: p.surface, borderColor: p.line }]}
              />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Saved so far (₹)">
              <TextInput
                value={savedText}
                onChangeText={(t) => setSavedText(t.replace(/[^0-9.,]/g, ''))}
                placeholder="0"
                placeholderTextColor={p.muted}
                keyboardType="decimal-pad"
                style={[styles.input, styles.amount, { color: p.ink, backgroundColor: p.surface, borderColor: p.line }]}
              />
            </Field>
          </View>
        </View>

        <Field label="Reach it in">
          <View style={styles.wrap}>
            {existing?.deadline && months === null ? (
              <Chip label={new Date(existing.deadline).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })} selected onPress={() => {}} />
            ) : null}
            {DEADLINES.map((d) => (
              <Chip
                key={d.months}
                label={d.label}
                selected={months === d.months || (months === null && !deadline && d.months === 0)}
                onPress={() => {
                  setMonths(d.months);
                  setDeadline(null);
                }}
              />
            ))}
          </View>
        </Field>

        <Field label="Icon and colour">
          <View style={styles.wrap}>
            {ICONS.map((i) => (
              <Chip key={i} label="" a11y={`Icon ${i.replace(/-outline$/, '').replace(/-/g, ' ')}`} icon={i} color={color} selected={icon === i} onPress={() => setIcon(i)} />
            ))}
          </View>
          <View style={[styles.wrap, { marginTop: space.sm }]}>
            {COLORS.map((c) => (
              <Chip key={c} label="" a11y={`Colour ${COLORS.indexOf(c) + 1}`} icon="circle" color={c} selected={color === c} onPress={() => setColor(c)} />
            ))}
          </View>
        </Field>

        <Button label={existing ? 'Save changes' : 'Create goal'} icon="check" onPress={save} disabled={!valid} />
        {existing ? <Button label="Delete goal" icon="trash-can-outline" kind="danger" onPress={remove} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const p = usePalette();
  return (
    <View style={{ gap: space.sm }}>
      <Txt variant="smallStrong" color={p.inkSoft}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  input: { fontFamily: fonts.regular, fontSize: 16, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.lg, height: 52 },
  amount: { fontFamily: fonts.number, fontSize: 20 },
});
