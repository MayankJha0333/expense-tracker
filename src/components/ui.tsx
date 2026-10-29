import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { SPRING } from '../lib/motion';
import type { IconName } from '../lib/types';
import { alpha, fonts, noticeColors, radius, space, type, usePalette, type NoticeTone, type TypeVariant } from '../theme';
import { PressScale, useFill } from './motion';

/** Text with the app's type scale and colours. */
export function Txt({
  variant = 'body',
  color,
  style,
  tabular,
  ...rest
}: TextProps & { variant?: TypeVariant; color?: string; tabular?: boolean }) {
  const p = usePalette();
  // Numbers (tabular) never wrap mid-amount: they stay on one line and shrink to fit,
  // so ₹1,23,45,678 can't break into "₹1,23,45,6 / 78". A screen can still pass its own numberOfLines.
  const fit = tabular && rest.numberOfLines === undefined ? { numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.6 } : null;
  return (
    <Text
      // Big text is already big: with the phone's largest font size it would push numbers off cards.
      maxFontSizeMultiplier={variant === 'display' || variant === 'title' ? 1.15 : variant === 'amount' ? 1.25 : 1.6}
      {...fit}
      {...rest}
      style={[
        type[variant] as TextStyle,
        { color: color ?? p.ink },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style as StyleProp<TextStyle>,
      ]}
    />
  );
}

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color?: string }) {
  const p = usePalette();
  return <MaterialCommunityIcons name={name} size={size} color={color ?? p.ink} />;
}

/** Section title on the left, optional small link on the right. */
export function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  onAction?: () => void;
}) {
  const p = usePalette();
  return (
    <View style={styles.sectionHeader}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="heading" accessibilityRole="header">
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" color={p.muted}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button" style={styles.link}>
          <Txt variant="smallStrong" color={p.accentInk} numberOfLines={1} style={{ flexShrink: 0 }}>
            {action}
          </Txt>
          <Icon name="chevron-right" size={16} color={p.accentInk} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Round icon tinted with a colour. */
export function Badge({ icon, color, size = 40 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: alpha(color, 0.15),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.52} color={color} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
  a11y,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  icon?: IconName;
  /** Spoken label, needed when the chip shows only an icon. */
  a11y?: string;
}) {
  const p = usePalette();
  const tint = color ?? p.ink;
  // Plain chips (filters) fill with the accent when picked; coloured ones (categories) get a tint.
  const solid = selected && !color;
  return (
    <PressScale
      onPress={onPress}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityLabel={a11y ?? label}
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: solid ? p.accent : selected ? alpha(tint, 0.16) : p.surface,
          borderColor: solid ? p.accent : selected ? tint : p.line,
        },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={label ? 16 : 20} color={solid ? p.onAccent : selected || !label ? tint : p.muted} /> : null}
      {label ? (
        <Txt variant="smallStrong" color={solid ? p.onAccent : selected ? p.ink : p.inkSoft}>
          {label}
        </Txt>
      ) : null}
    </PressScale>
  );
}

/** A raised block on the page. */
export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.line, boxShadow: p.shadowCard }, padded && { padding: space.lg }, style]}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
  compact,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'accent' | 'secondary' | 'quiet' | 'danger';
  icon?: IconName;
  disabled?: boolean;
  compact?: boolean;
}) {
  const p = usePalette();
  const look = {
    primary: { bg: p.ink, fg: p.bg, border: p.ink },
    accent: { bg: p.accent, fg: p.onAccent, border: p.accent },
    secondary: { bg: p.surface, fg: p.ink, border: p.line },
    quiet: { bg: 'transparent', fg: p.ink, border: 'transparent' },
    danger: { bg: p.dangerSoft, fg: p.danger, border: p.dangerSoft },
  }[kind];
  return (
    <PressScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[styles.button, compact && styles.buttonCompact, { backgroundColor: look.bg, borderColor: look.border, opacity: disabled ? 0.4 : 1 }]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={compact ? 16 : 18} color={look.fg} /> : null}
      <Txt variant={compact ? 'smallStrong' : 'bodyStrong'} color={look.fg}>
        {label}
      </Txt>
    </PressScale>
  );
}

export function IconButton({ icon, onPress, label, tint }: { icon: IconName; onPress: () => void; label: string; tint?: string }) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.iconButton, { backgroundColor: p.surface, borderColor: p.line, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={20} color={tint ?? p.ink} />
    </Pressable>
  );
}

/** Thin horizontal bar showing a share (0..1). */
export function ShareBar({ share, color, height = 6, track, delay = 0 }: { share: number; color: string; height?: number; track?: string; delay?: number }) {
  const p = usePalette();
  const target = Math.max(share > 0 ? 0.02 : 0, Math.min(1, Number.isFinite(share) ? share : 0));
  // Fills from the left when it first shows, then glides to new values.
  const fill = useFill(target, delay);
  const bar = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: track ?? p.track, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: height / 2, backgroundColor: color }, bar]} />
    </View>
  );
}

/** Small rounded label. */
export function Tag({ label, color, icon }: { label: string; color: string; icon?: IconName }) {
  return (
    <View style={[styles.tag, { backgroundColor: alpha(color, 0.14) }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={12} color={color} /> : null}
      <Txt variant="tiny" color={color}>
        {label}
      </Txt>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const p = usePalette();
  const reduced = useReducedMotion();
  const index = Math.max(0, options.findIndex((o) => o.id === value));
  // The highlight slides under the picked option instead of jumping.
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - 8 - 4 * (options.length - 1)) / options.length : 0;
  const x = useSharedValue(index * (segment + 4));
  const target = index * (segment + 4);
  const placed = useRef(false);
  useEffect(() => {
    if (segment <= 0) return;
    // First placement jumps (nothing to slide from); later changes glide.
    x.set(!placed.current || reduced ? target : withSpring(target, SPRING));
    placed.current = true;
  }, [target, segment, reduced, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return (
    <View
      style={[styles.segmented, { backgroundColor: p.surface, borderColor: p.line }]}
      accessibilityRole="tablist"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {segment > 0 ? (
        <Animated.View pointerEvents="none" style={[styles.segmentThumb, { width: segment, backgroundColor: p.accent }, thumb]} />
      ) : null}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && segment === 0 && { backgroundColor: p.accent, borderColor: p.accent }]}
          >
            <Txt variant="smallStrong" color={on ? p.onAccent : p.muted}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A tappable row for settings-style lists. */
export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  href,
}: {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  href?: Href;
}) {
  const p = usePalette();
  const press = onPress ?? (href ? () => router.push(href) : undefined);
  return (
    <Pressable
      onPress={press}
      disabled={!press}
      accessibilityRole={press ? 'button' : undefined}
      style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      {icon ? <Badge icon={icon} color={iconColor ?? p.inkSoft} size={36} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="bodyStrong">{title}</Txt>
        {subtitle ? (
          <Txt variant="small" color={p.muted}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (press ? <Icon name="chevron-right" size={20} color={p.muted} /> : null)}
    </Pressable>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.line, marginLeft: inset }} />;
}

export function Empty({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: p.surfaceAlt }]}>
        <Icon name={icon} size={28} color={p.muted} />
      </View>
      <Txt variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </Txt>
      <Txt variant="small" color={p.muted} style={{ textAlign: 'center', maxWidth: 300 }}>
        {body}
      </Txt>
      {children}
    </View>
  );
}

/** Small outlined label for how something was paid: "UPI", "HDFC card ••7788". */
export function PayBadge({ label, dashed }: { label: string; dashed?: boolean }) {
  const p = usePalette();
  return (
    <View style={[styles.payBadge, { borderColor: p.line, borderStyle: dashed ? 'dashed' : 'solid' }]}>
      <Txt variant="tiny" color={p.inkSoft} numberOfLines={1}>
        {label}
      </Txt>
    </View>
  );
}

/** A label + amount + share on one line, with a bar under it. [fill] is the bar length 0..1. */
export function AmountBar({
  label,
  amount,
  share,
  fill,
  color,
  onPress,
  sub,
}: {
  label: string;
  amount: string;
  share?: string;
  fill: number;
  color?: string;
  onPress?: () => void;
  sub?: string;
}) {
  const p = usePalette();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}, ${amount}${share ? `, ${share}` : ''}`}
      style={({ pressed }) => [{ gap: 6, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.amountBarHead}>
        <Txt variant="body" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Txt>
        <Txt variant="bodyStrong" tabular numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ flexShrink: 1, maxWidth: '62%' }}>
          {amount}
        </Txt>
        {share ? (
          <Txt variant="small" color={p.muted} tabular style={{ minWidth: 36, textAlign: 'right' }}>
            {share}
          </Txt>
        ) : null}
      </View>
      <ShareBar share={fill} color={color ?? p.accent} height={8} />
      {sub ? (
        <Txt variant="tiny" color={p.muted}>
          {sub}
        </Txt>
      ) : null}
    </Pressable>
  );
}

/** One bar split into parts (payment methods), with gaps between parts. */
export function MixBar({ parts, height = 16, label }: { parts: { share: number; color: string }[]; height?: number; label: string }) {
  const shown = parts.filter((x) => x.share > 0.004);
  if (shown.length === 0) return <View style={{ height }} />;
  return (
    <View style={{ flexDirection: 'row', height, gap: 3 }} accessible accessibilityRole="image" accessibilityLabel={label}>
      {shown.map((x, i) => (
        <MixPart key={i} share={x.share} color={x.color} first={i === 0} last={i === shown.length - 1} index={i} />
      ))}
    </View>
  );
}

/** One part of a MixBar; grows to its share, one after another. */
function MixPart({ share, color, first, last, index }: { share: number; color: string; first: boolean; last: boolean; index: number }) {
  const fill = useFill(share, index * 70);
  const grow = useAnimatedStyle(() => ({ flexGrow: Math.max(0.0001, fill.get()) }));
  return (
    <Animated.View
      style={[
        {
          flexBasis: 0,
          backgroundColor: color,
          borderTopLeftRadius: first ? 6 : 2,
          borderBottomLeftRadius: first ? 6 : 2,
          borderTopRightRadius: last ? 6 : 2,
          borderBottomRightRadius: last ? 6 : 2,
        },
        grow,
      ]}
    />
  );
}

/** A row you tap to go somewhere: icon, two lines of text, chevron. Used for alerts on Home. */
export function NoticeRow({
  tone = 'neutral',
  icon,
  title,
  body,
  pill,
  onPress,
  compact,
}: {
  /** Decides every colour in the row. See `noticeColors` in lib/palette.ts. */
  tone?: NoticeTone;
  icon: IconName;
  title: string;
  body?: string;
  /** A short label on the right: what to do ("Review") or how urgent ("8 days"). */
  pill?: string;
  onPress?: () => void;
  /** Slim version for app status (sample data) so it doesn't fight the hero card. */
  compact?: boolean;
}) {
  const p = usePalette();
  const c = noticeColors(p, tone);
  const tile = compact ? 34 : 44;
  return (
    <PressScale
      onPress={onPress}
      disabled={!onPress}
      scaleTo={0.98}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, body, pill].filter(Boolean).map((t) => String(t).replace(/[.\s]+$/, '')).join('. ')}
      style={[styles.notice, compact && styles.noticeCompact, { backgroundColor: c.cardBg, borderColor: c.border }, c.shadow ? { boxShadow: c.shadow } : null]}
    >
      <View style={[styles.noticeIcon, { width: tile, height: tile, borderRadius: compact ? 11 : 14, backgroundColor: c.tileBg }]}>
        <MaterialCommunityIcons name={icon} size={compact ? 18 : 22} color={c.tileFg} />
      </View>
      <View style={{ flex: 1, gap: compact ? 0 : 2 }}>
        <Txt variant={compact ? 'smallStrong' : 'bodyStrong'} numberOfLines={compact ? 1 : 2}>
          {title}
        </Txt>
        {body ? (
          <Txt variant="small" color={p.muted} numberOfLines={compact ? 1 : 2}>
            {body}
          </Txt>
        ) : null}
      </View>
      {pill ? (
        <View style={[styles.noticePill, { backgroundColor: c.pillBg }]}>
          <Txt variant="smallStrong" color={c.pillFg} numberOfLines={1}>
            {pill}
          </Txt>
          {onPress ? <MaterialCommunityIcons name="chevron-right" size={16} color={c.pillFg} style={{ marginRight: -4 }} /> : null}
        </View>
      ) : onPress ? (
        <Icon name="chevron-right" size={20} color={p.muted} />
      ) : null}
    </PressScale>
  );
}

export const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md, marginBottom: space.md },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2, minHeight: 32, flexShrink: 0 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    minHeight: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  card: { borderRadius: radius.md + 4, borderWidth: StyleSheet.hairlineWidth },
  button: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: space.lg },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, alignSelf: 'flex-start' },
  segmented: { flexDirection: 'row', borderRadius: radius.md - 2, padding: 4, gap: 4, borderWidth: StyleSheet.hairlineWidth },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
  },
  segmentThumb: { position: 'absolute', top: 4, bottom: 4, left: 4, borderRadius: radius.sm },
  payBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1, maxWidth: 160 },
  amountBarHead: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md + 4,
    borderWidth: 1,
    paddingVertical: space.md + 2,
    paddingLeft: space.md + 2,
    paddingRight: space.md,
  },
  noticeCompact: { paddingVertical: space.sm + 2, paddingLeft: space.sm + 2, gap: space.sm + 2 },
  noticeIcon: { alignItems: 'center', justifyContent: 'center' },
  noticePill: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 30, paddingHorizontal: space.md, borderRadius: radius.pill, flexShrink: 0 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
});

export { fonts };
