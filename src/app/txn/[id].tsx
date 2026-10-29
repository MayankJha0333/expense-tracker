import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../../components/ScreenHeader';
import { flowLabel, TxnRow } from '../../components/finance';
import { Badge, Button, Chip, Empty, NoticeRow, Txt } from '../../components/ui';
import { Stagger } from '../../components/motion';
import { PurposePicker } from '../../components/PurposePicker';
import { needsReview, payLabel } from '../../lib/accounts';
import { dayLabel, timeLabel } from '../../lib/analytics';
import { CURRENCIES, currencyOf, getHomeCurrency } from '../../lib/currency';
import { money } from '../../lib/money';
import { canHavePurpose, kindLabel } from '../../lib/purposes';
import { useStore } from '../../lib/store';
import { cat, CREDIT_CATEGORIES, DEBIT_CATEGORIES, isForeign, PAY_MODE_LABEL, shownAmount, type CategoryId, type Txn } from '../../lib/types';
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
  const { find, setCategory, setExcluded, deleteManual, confirmCategory, txns, unlinkTxns } = useStore();
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
  const samePerson = txns.filter((t) => t.merchantKey === txn.merchantKey && t.type === txn.type && t.id !== txn.id && !t.isManual).length;
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
          {money(shownAmount(txn), { currency: code, decimals: true })}
        </Txt>
        <Txt variant="small" color={p.muted}>
          {credit ? 'Money in' : c.isSaving ? 'Saved' : 'Money out'} · {flowLabel(txn) ?? kindLabel(txn, c.label)}
        </Txt>
        {txn.grossAmount !== undefined && !txn.netted ? (
          <Txt variant="smallStrong" color={p.income}>
            {money(txn.grossAmount - txn.amount, { currency: code })} came back · you spent {money(txn.amount, { currency: code })}
          </Txt>
        ) : null}
      </View>
      <Linked txn={txn} others={(txn.links ?? []).map((l) => find(l.otherId)).filter((o): o is Txn => !!o)} onUnlink={(o) => unlinkTxns(txn, o)} />

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
                ? 'Money from a person may be a friend paying you back, lent money coming back, or a loan. Pick why below so it is not counted as income.'
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

      {canHavePurpose(txn) ? (
        <View style={{ gap: space.md }}>
          <Txt variant="heading">{credit ? `Why did ${txn.merchant} pay you?` : `What do you pay ${txn.merchant} for?`}</Txt>
          <Txt variant="small" color={p.muted}>
            {samePerson > 0
              ? `Pick once. This and the other ${samePerson} ${samePerson === 1 ? 'payment' : 'payments'} ${credit ? 'from' : 'to'} them move to the right place, and new ones too.`
              : `Pick once. Future payments ${credit ? 'from' : 'to'} them go to the right place too.`}
            {credit ? ' Lent money back, a loan, or a friend paying back is not counted as income.' : ' Lent money and loan repayments are not counted as spending.'}
          </Txt>
          <PurposePicker txn={txn} />
          {credit ? null : (
            <Button label="Sort everyone you pay" icon="account-multiple-check-outline" kind="quiet" compact onPress={() => router.push('/people')} />
          )}
        </View>
      ) : null}

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

/** The payments this one is linked to, why, and a way to undo it or link one by hand. */
function Linked({ txn, others, onUnlink }: { txn: Txn; others: Txn[]; onUnlink: (other: Txn) => void }) {
  const p = usePalette();
  const credit = txn.type === 'credit';
  const link = txn.links?.[0];
  if (!link || others.length === 0) {
    if (txn.isManual) return null;
    return (
      <View style={{ gap: space.sm }}>
        <Txt variant="small" color={p.muted}>
          {credit
            ? 'Is this money from your own account, or a refund? Link it to the other payment so it isn\'t counted as income.'
            : 'Moved this to your own account, or got a refund for it? Link the other payment so your totals stay right.'}
        </Txt>
        <Button label="Link to another payment" icon="link-variant" kind="secondary" compact onPress={() => router.push(`/link/${txn.id}`)} />
      </View>
    );
  }
  const transfer = link.kind === 'transfer';
  const title = transfer ? (txn.category === 'card_bill' ? 'Card bill, both sides' : 'Same money, your accounts') : credit ? 'Refund for' : 'Money back';
  const body = transfer
    ? txn.category === 'card_bill'
      ? 'Paying your own card bill is not new spending: what you bought on the card already counted.'
      : credit
        ? 'This came from your own account, so it is not counted as income.'
        : 'This went to your own account, so it is not counted as spending.'
    : credit
      ? 'Taken off the purchase below, so it is not counted as income.'
      : txn.netted
        ? 'You got all of it back, so this purchase is not counted as spending.'
        : `Only what you kept, ${money(txn.amount)}, counts as spending.`;
  return (
    <View style={{ gap: space.sm }}>
      <Txt variant="heading">{title}</Txt>
      <Txt variant="small" color={p.muted}>
        {body} {link.source === 'auto' ? 'Kharcha linked these on its own.' : 'You linked these.'}
      </Txt>
      {others.map((o) => (
        <View key={o.id} style={[styles.linkCard, { backgroundColor: p.surface, borderColor: p.line }]}>
          <TxnRow txn={o} showDate />
          <Button label="Not related, unlink" icon="link-variant-off" kind="quiet" compact onPress={() => onUnlink(o)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  linkCard: { borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: space.md, paddingBottom: space.xs },
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
