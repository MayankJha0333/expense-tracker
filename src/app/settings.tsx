import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '../components/ScreenHeader';
import { useAskForSms } from '../components/SmsConsent';
import { SmsNotice } from '../components/SmsNotice';
import { Button, Card, Chip, Divider, Icon, ListRow, SectionHeader, Segmented, Tag, Txt } from '../components/ui';
import { PressScale, Stagger } from '../components/motion';
import { CURRENCIES, CURRENCY_CODES } from '../lib/currency';
import { SAMPLE_DATA_ENABLED, type SampleKind } from '../lib/demo';
import { DESIGN_SYSTEM_ENABLED } from '../lib/devTools';
import { installInfo, smsSupported } from '../lib/sms';
import { useStore } from '../lib/store';
import type { IconName } from '../lib/types';
import { alpha, ELECTRIC, ELECTRIC_IDS, MIDNIGHT, MIDNIGHT_IDS, radius, space, usePalette, useTheme, type ThemeMode } from '../theme';

const SOURCE_LABEL = { sms: 'Bank SMS on this phone', manual: 'Entries you add by hand', demo: 'Sample data (not saved)' } as const;

const INSTALL_LABEL: Record<string, string> = {
  store: 'an app store',
  local_file: 'a file on this phone',
  downloaded_file: 'a downloaded file',
  other: 'a computer (adb) or another installer',
  unspecified: 'an unknown source',
  unknown: 'an unknown source',
};

const BY_DESIGN: { icon: IconName; text: string }[] = [
  { icon: 'account-off-outline', text: 'No account, no sign-up, no server' },
  { icon: 'radar', text: 'No analytics, ads, crash reporting or trackers' },
  { icon: 'format-font', text: 'Fonts and icons are built in, nothing is downloaded' },
  { icon: 'cloud-off-outline', text: 'Android cloud backup is turned off' },
  { icon: 'message-lock-outline', text: 'Chats from people are dropped before the app reads them' },
];

export default function Settings() {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { source, permission, chooseSource, eraseAll, goals, budget, txns } = useStore();
  const askForSms = useAskForSms();
  const install = installInfo();

  const manualCount = txns.filter((t) => t.isManual).length;

  const confirmErase = () => {
    Alert.alert(
      'Delete all your data?',
      'This removes your cash entries, goals, budget, category rules and choices from this phone. Your SMS inbox is not touched. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await eraseAll();
            router.replace('/welcome');
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: p.bg }}
      contentContainerStyle={{ paddingTop: insets.top, paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.xxl, gap: space.xl }}
    >
      <Stagger>
      <ScreenHeader />
      <Txt variant="title" accessibilityRole="header">
        Settings & privacy
      </Txt>

      <Appearance />

      <CurrencySection />

      <View style={[styles.hero, { backgroundColor: p.card }]}>
        <View style={styles.heroHead}>
          <View style={[styles.shield, { backgroundColor: alpha(p.cardIncome, 0.16) }]}>
            <Icon name="shield-lock" size={26} color={p.cardIncome} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading" color={p.cardText}>
              Your data stays on this phone
            </Txt>
            <Txt variant="small" color={p.cardMuted}>
              No account and no server. Nothing you track is uploaded.
            </Txt>
          </View>
        </View>
      </View>

      <View>
        <SectionHeader title="By design" />
        <Card style={{ gap: space.md }}>
          {BY_DESIGN.map((b) => (
            <View key={b.text} style={styles.designRow}>
              <Icon name={b.icon} size={20} color={p.income} />
              <Txt variant="small" style={{ flex: 1 }}>
                {b.text}
              </Txt>
            </View>
          ))}
        </Card>
      </View>

      <View>
        <SectionHeader title="Where your payments come from" />
        <Card style={{ gap: space.md }}>
          <View style={styles.designRow}>
            <Txt variant="bodyStrong" style={{ flex: 1 }}>
              {source ? SOURCE_LABEL[source] : 'Not set up'}
            </Txt>
            {source === 'sms' && permission === 'granted' ? <Tag label="SMS allowed" color={p.income} icon="check" /> : null}
          </View>

          {source === 'demo' ? (
            <>
              <Txt variant="small" color={p.muted}>
                Sample data is made up and kept only in memory. Your own entries are kept separately and come back when you switch.
              </Txt>
              {smsSupported ? <Button label="Use my bank SMS" icon="message-text-outline" onPress={askForSms} /> : null}
              <Button label="Add entries by hand" kind="secondary" icon="pencil-outline" onPress={() => chooseSource('manual')} />
            </>
          ) : (
            <>
              <SmsNotice />
              {SAMPLE_DATA_ENABLED ? (
                <Button label="Explore with sample data (dev)" kind="secondary" icon="flask-outline" onPress={() => chooseSource('demo')} />
              ) : null}
            </>
          )}

          {install ? (
            <Txt variant="tiny" color={p.muted}>
              Android {install.sdk >= 35 ? '15 or later' : `API ${install.sdk}`} · installed from {INSTALL_LABEL[install.source] ?? install.source}
              {install.installer ? ` (${install.installer})` : ''}
            </Txt>
          ) : null}
        </Card>
      </View>

      <View>
        <SectionHeader title="Your data" subtitle="Saved only in Kharcha's private storage on this phone" />
        <Card style={{ gap: space.md }}>
          <View style={styles.counts}>
            <Count value={manualCount} label="cash entries" />
            <Count value={goals.length} label={goals.length === 1 ? 'goal' : 'goals'} />
            <Count value={budget ? 1 : 0} label="budget" />
          </View>
          <Txt variant="small" color={p.muted}>
            Payments from SMS are not saved; they are read again from your inbox. Deleting removes only what Kharcha saved.
          </Txt>
          <Button label="Delete all my data" kind="danger" icon="trash-can-outline" onPress={confirmErase} />
        </Card>
      </View>

      <View>
        <SectionHeader title="About" />
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          <ListRow icon="file-document-outline" title="Privacy policy" subtitle="What Kharcha reads, keeps and never does" href="/privacy" />
          <Divider inset={48} />
          {DESIGN_SYSTEM_ENABLED ? (
            <>
              <ListRow icon="palette-swatch-outline" title="Design system" subtitle="Every colour, font and component, in all 8 themes" href="/design-system" />
              <Divider inset={48} />
            </>
          ) : null}
          <ListRow icon="information-outline" title="Version" subtitle={`Kharcha ${Constants.expoConfig?.version ?? ''}${__DEV__ ? ' (development build)' : ''}`} />
        </Card>
      </View>
      </Stagger>
    </ScrollView>
  );
}

const MODES: { id: ThemeMode; label: string }[] = [
  { id: 'system', label: 'Auto' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/** Light / dark / follow the phone, and one colour for each mode. Saved on this phone. */
function Appearance() {
  const p = usePalette();
  const { mode, scheme, midnight, electric, setMode, setMidnight, setElectric } = useTheme();
  const tap = () => Haptics.selectionAsync().catch(() => {});
  return (
    <View>
      <SectionHeader title="Appearance" subtitle={mode === 'system' ? `Auto: follows your phone (${scheme} now)` : `Always ${mode}`} />
      <Card style={{ gap: space.lg }}>
        <Segmented
          value={mode}
          onChange={(m) => {
            tap();
            setMode(m);
          }}
          options={MODES}
        />
        <SwatchRow
          title="Dark mode colour"
          family="Midnight"
          active={scheme === 'dark'}
          items={MIDNIGHT_IDS.map((id) => ({ id, name: MIDNIGHT[id].name, fill: MIDNIGHT[id].bright, dot: null, check: '#0A0A0B' }))}
          value={midnight}
          onPick={(id) => {
            tap();
            setMidnight(id);
          }}
        />
        <SwatchRow
          title="Light mode colour"
          family="Electric"
          active={scheme === 'light'}
          items={ELECTRIC_IDS.map((id) => ({ id, name: ELECTRIC[id].name, fill: ELECTRIC[id].primary, dot: ELECTRIC[id].highlight, check: '#FFFFFF' }))}
          value={electric}
          onPick={(id) => {
            tap();
            setElectric(id);
          }}
        />
        <Txt variant="small" color={p.muted}>
          Dark mode uses the Midnight colours, light mode uses the Electric colours. Pick one of each.
        </Txt>
      </Card>
    </View>
  );
}

/** The tick pops in on the colour you pick. */
const checkIn = ZoomIn.springify().damping(12).stiffness(280).reduceMotion(ReduceMotion.System);

const SAMPLE_LABEL: Record<SampleKind, string> = { india: 'India (₹)', us: 'US ($)', stress: 'Stress test' };

/** Which currency totals use. Auto follows your payments; other currencies are listed but never added up. */
function CurrencySection() {
  const p = usePalette();
  const { currency, currencySetting, autoCurrency, setCurrencySetting, source, sample, setSample } = useStore();
  const tap = () => Haptics.selectionAsync().catch(() => {});
  const info = CURRENCIES[currency];
  return (
    <View>
      <SectionHeader title="Currency" subtitle={`Totals are in ${info.symbol.trim()} ${info.name}${currencySetting === 'auto' ? ' (auto)' : ''}`} />
      <Card style={{ gap: space.md }}>
        <View style={styles.chipWrap}>
          <Chip
            label={`Auto · ${CURRENCIES[autoCurrency].symbol.trim()}`}
            a11y={`Auto, now ${CURRENCIES[autoCurrency].name}`}
            selected={currencySetting === 'auto'}
            onPress={() => {
              tap();
              setCurrencySetting('auto');
            }}
          />
          {CURRENCY_CODES.map((code) => (
            <Chip
              key={code}
              label={CURRENCIES[code].symbol.trim() === code ? code : `${CURRENCIES[code].symbol.trim()} ${code}`}
              a11y={CURRENCIES[code].name}
              selected={currencySetting === code}
              onPress={() => {
                tap();
                setCurrencySetting(code);
              }}
            />
          ))}
        </View>
        <Txt variant="small" color={p.muted}>
          Auto uses the currency most of your payments are in. Payments in other currencies still show in your lists, but they are not added to totals, because Kharcha has no exchange rates offline.
        </Txt>
        {SAMPLE_DATA_ENABLED && source === 'demo' ? (
          <View style={{ gap: space.sm }}>
            <Txt variant="smallStrong">Sample data (development build only)</Txt>
            <View style={styles.chipWrap}>
              {(['india', 'us', 'stress'] as const).map((k) => (
                <Chip
                  key={k}
                  label={SAMPLE_LABEL[k]}
                  a11y={`Sample ${SAMPLE_LABEL[k]}`}
                  selected={sample === k}
                  onPress={() => {
                    tap();
                    setSample(k);
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function SwatchRow<T extends string>({
  title,
  family,
  active,
  items,
  value,
  onPick,
}: {
  title: string;
  family: string;
  active: boolean;
  items: { id: T; name: string; fill: string; dot: string | null; check: string }[];
  value: T;
  onPick: (id: T) => void;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: space.sm }} accessibilityRole="radiogroup" accessibilityLabel={`${title}, ${family}`}>
      <View style={styles.swatchHead}>
        <Txt variant="smallStrong" color={p.inkSoft}>
          {title} · {family}
        </Txt>
        {active ? <Tag label="In use now" color={p.accentInk} /> : null}
      </View>
      <View style={styles.swatches}>
        {items.map((it) => {
          const on = it.id === value;
          return (
            <PressScale
              key={it.id}
              scaleTo={0.92}
              onPress={() => onPick(it.id)}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${family} ${it.name}`}
              style={styles.swatchBtn}
            >
              <View style={[styles.swatchRing, { borderColor: on ? p.ink : 'transparent' }]}>
                <View style={[styles.swatchTile, { backgroundColor: it.fill }]}>
                  {it.dot ? <View style={[styles.swatchDot, { backgroundColor: it.dot }]} /> : null}
                  {on ? (
                    <Animated.View entering={checkIn}>
                      <Icon name="check-bold" size={20} color={it.check} />
                    </Animated.View>
                  ) : null}
                </View>
              </View>
              <Txt variant="small" color={on ? p.ink : p.muted} style={on ? { fontFamily: 'Sora_600SemiBold' } : undefined}>
                {it.name}
              </Txt>
            </PressScale>
          );
        })}
      </View>
    </View>
  );
}

function Count({ value, label }: { value: number; label: string }) {
  const p = usePalette();
  return (
    <View style={[styles.count, { backgroundColor: p.surfaceAlt }]}>
      <Txt variant="amount" tabular>
        {value}
      </Txt>
      <Txt variant="tiny" color={p.muted}>
        {label}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  hero: { borderRadius: radius.lg, padding: space.xl },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  shield: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  designRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  counts: { flexDirection: 'row', gap: space.sm },
  swatches: { flexDirection: 'row', justifyContent: 'space-between' },
  swatchHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  swatchDot: { position: 'absolute', right: 7, top: 7, width: 10, height: 10, borderRadius: 5 },
  swatchBtn: { alignItems: 'center', gap: 6, minWidth: 64 },
  swatchRing: { borderWidth: 2, borderRadius: 20, padding: 3 },
  swatchTile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  count: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.sm },
});
