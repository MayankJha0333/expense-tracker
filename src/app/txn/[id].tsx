import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { Badge, Button, Chip, Empty, NoticeRow, Txt } from '../../components/ui';
import { Stagger } from '../../components/motion';
import { needsReview, payLabel } from '../../lib/accounts';
import { dayLabel, timeLabel } from '../../lib/analytics';
import { CURRENCIES, currencyOf, getHomeCurrency } from '../../lib/currency';
import { money } from '../../lib/money';
import { useStore } from '../../lib/store';
import { cat, CREDIT_CATEGORIES, DEBIT_CATEGORIES, isForeign, PAY_MODE_LABEL, type CategoryId } from '../../lib/types';
import { radius, space, usePalette } from '../../theme';

const SOURCE_TEXT = {
  auto: 'Sorted on its own from the message',
  rule: 'Sorted by a rule you made for this shop',
  manual: 'You picked this category',
} as const;

export default function TxnDetail() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { find, setCategory, setExcluded, deleteManual, confirmCategory, txns } = useStore();
  const txn = id ? find(id) : undefined;
  const [applyToAll, setApplyToAll] = useState(true);

  if (!txn) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top, paddingHorizontal: space.lg }}>
        <ScreenHeader close />
        <Empty icon="information-outline" title="Payment not found" body="It may have been deleted." />
      </View>
    );
  }

  const c = cat(txn.category);
  const credit = txn.type === 'credit';
  const options = credit ? CREDIT_CATEGORIES : DEBIT_CATEGORIES;
  const sameShop = txns.filter((t) => t.merchantKey === txn.merchantKey && t.id !== txn.id && !t.isManual).length;
  const notCountable = !credit && !c.countsAsSpend;
  const countLabel = c.isSaving ? 'Count in my savings' : credit ? 'Count as money in' : 'Count in my spending';

  const pick = (next: CategoryId) => {
    if (next === txn.category) return;
    Haptics.selectionAsync().catch(() => {});
    setCategory(txn, next, applyToAll && !txn.isManual);
  };

  const details: [string, string][] = [
    ['When', `${dayLabel(txn.timestamp)}, ${timeLabel(txn.timestamp)}`],
    [
      credit ? 'Received via' : 'Paid with',
      txn.isManual
        ? `${PAY_MODE_LABEL[txn.mode]} (added by you)`
        : payLabel(txn) === PAY_MODE_LABEL[txn.mode]
          ? PAY_MODE_LABEL[txn.mode]
          : `${PAY_MODE_LABEL[txn.mode]} · ${payLabel(txn)}`,
    ],
  ];
  if (txn.bank || txn.account) details.push([txn.mode === 'card' ? 'Card' : 'Account', [txn.bank, txn.account ? `ending ${txn.account}` : null].filter(Boolean).join(', ')]);
  const review = needsReview(txn);
  if (txn.note) details.push(['Note', txn.note]);
  const foreign = isForeign(txn);
  const code = currencyOf(txn);

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <Stagger>
      <ScreenHeader close />

      <View style={{ alignItems: 'center', gap: space.sm }}>
        <Badge icon={c.icon} color={c.color} size={56} />
        <Txt variant="heading" style={{ textAlign: 'center' }}>
          {txn.merchant}
        </Txt>
        <Txt variant="display" color={credit ? p.income : p.ink} tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={{ alignSelf: 'stretch', textAlign: 'center' }}>
          {credit ? '+' : ''}
          {money(txn.amount, { currency: code, decimals: true })}
        </Txt>
        <Txt variant="small" color={p.muted}>
          {credit ? 'Money in' : c.isSaving ? 'Saved' : 'Money out'} · {c.label}
        </Txt>
      </View>

      {foreign ? (
        <NoticeRow
          tone="info"
          icon="earth"
          title={`Paid in ${CURRENCIES[code].name} (${code})`}
          body={`Not added to your ${CURRENCIES[getHomeCurrency()].symbol.trim()} totals. Kharcha works offline, so it has no exchange rates.`}
        />
      ) : null}

      {review ? (
        <View style={{ gap: space.sm }}>
          <NoticeRow
            tone="warn"
            icon="help-circle-outline"
            title={credit ? 'Is this really income?' : "We weren't sure what this was"}
            body={
              credit
                ? 'Money from a person may be a friend paying you back. If so, turn off "Count as money in" below.'
                : 'Pick the right category below, or confirm it if "Other" is right.'
            }
          />
          <Button
            label={credit ? 'Yes, it is income' : 'Other is right'}
            icon="check"
            kind="secondary"
            compact
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              confirmCategory(txn);
            }}
          />
        </View>
      ) : null}

      <View style={[styles.table, { borderColor: p.line }]}>
        {details.map(([k, v]) => (
          <View key={k} style={[styles.tableRow, { borderColor: p.line }]}>
            <Txt variant="small" color={p.muted}>
              {k}
            </Txt>
            <Txt variant="smallStrong" style={{ flex: 1, textAlign: 'right' }}>
              {v}
            </Txt>
          </View>
        ))}
      </View>

      <View style={{ gap: space.md }}>
        <Txt variant="heading">Category</Txt>
        <Txt variant="small" color={p.muted}>
          {SOURCE_TEXT[txn.categorySource]}
        </Txt>
        <View style={styles.grid}>
          {options.map((o) => (
            <Chip key={o.id} label={o.label} icon={o.icon} color={o.color} selected={o.id === txn.category} onPress={() => pick(o.id)} />
          ))}
        </View>
        {!txn.isManual && sameShop > 0 ? (
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Txt variant="bodyStrong">Use for all {txn.merchant} payments</Txt>
              <Txt variant="small" color={p.muted}>
                Also changes {sameShop} other {sameShop === 1 ? 'payment' : 'payments'}, and new ones from now on.
              </Txt>
            </View>
            <Switch value={applyToAll} onValueChange={setApplyToAll} trackColor={{ true: p.accent, false: p.line }} thumbColor={p.surface} />
          </View>
        ) : null}
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Txt variant="bodyStrong">{countLabel}</Txt>
          <Txt variant="small" color={p.muted}>
            {c.isSaving
              ? 'Investments are money you kept, so they count toward savings, not spending.'
              : notCountable
                ? `${c.label} is never counted, so the same money isn't added twice.`
                : 'Turn off for things like moving money to your own account.'}
          </Txt>
        </View>
        <Switch
          value={!txn.excluded}
          disabled={notCountable && !c.isSaving}
          onValueChange={(v) => setExcluded(txn, !v)}
          trackColor={{ true: p.accent, false: p.line }}
          thumbColor={p.surface}
        />
      </View>

      {txn.rawSms ? (
        <View style={{ gap: space.sm }}>
          <Txt variant="heading">Original message</Txt>
          <View style={[styles.sms, { backgroundColor: p.surface, borderColor: p.line }]}>
            {txn.sender ? (
              <Txt variant="tiny" color={p.muted}>
                From {txn.sender}
              </Txt>
            ) : null}
            <Txt variant="small" color={p.inkSoft} selectable>
              {txn.rawSms}
            </Txt>
          </View>
        </View>
      ) : null}

      {txn.isManual ? (
        <Button
          label={credit ? 'Delete this income' : 'Delete this expense'}
          kind="danger"
          icon="trash-can-outline"
          onPress={() => {
            deleteManual(txn.id);
            router.back();
          }}
        />
      ) : null}
      </Stagger>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  table: { borderTopWidth: StyleSheet.hairlineWidth },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  sms: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: space.lg, gap: 6 },
});
