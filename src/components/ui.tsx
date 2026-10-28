import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';

import type { IconName } from '../lib/types';
import { alpha, fonts, radius, space, type, usePalette, type TypeVariant } from '../theme';

/** Text with the app's type scale and colours. */
export function Txt({
  variant = 'body',
  color,
  style,
  tabular,
  ...rest
}: TextProps & { variant?: TypeVariant; color?: string; tabular?: boolean }) {
  const p = usePalette();
  return (
    <Text
      {...rest}
      style={[
        type[variant],
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
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  const p = usePalette();
  return (
    <View style={styles.sectionHeader}>
      <Txt variant="heading">{title}</Txt>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Txt variant="smallStrong" color={p.muted}>
            {action}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Round icon tinted with the category colour. */
export function Badge({ icon, color, size = 40 }: { icon: IconName; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: alpha(color, 0.16),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <MaterialCommunityIcons name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  color,
  icon,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
  icon?: IconName;
}) {
  const p = usePalette();
  const tint = color ?? p.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? alpha(tint, 0.14) : p.surface,
          borderColor: selected ? tint : p.line,
        },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={16} color={selected ? tint : p.muted} /> : null}
      <Txt variant="smallStrong" color={selected ? p.ink : p.inkSoft}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** A plain block on the page. Used sparingly; most content sits right on the paper. */
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return <View style={[styles.panel, { backgroundColor: p.surface, borderColor: p.line }, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'quiet';
  icon?: IconName;
  disabled?: boolean;
}) {
  const p = usePalette();
  const primary = kind === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: primary ? p.ink : 'transparent',
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={18} color={primary ? p.bg : p.ink} /> : null}
      <Txt variant="bodyStrong" color={primary ? p.bg : p.ink}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Thin horizontal bar showing a share (0..1). */
export function ShareBar({ share, color, height = 6 }: { share: number; color: string; height?: number }) {
  const p = usePalette();
  return (
    <View style={{ height, borderRadius: height / 2, backgroundColor: p.surfaceAlt, overflow: 'hidden' }}>
      <View
        style={{
          width: `${Math.max(2, Math.min(100, share * 100))}%`,
          height: '100%',
          borderRadius: height / 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function Empty({ icon, title, body, children }: { icon: IconName; title: string; body: string; children?: ReactNode }) {
  const p = usePalette();
  return (
    <View style={styles.empty}>
      <Icon name={icon} size={32} color={p.muted} />
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

export const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  panel: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
  },
  button: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
  },
  empty: {
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xxl,
    paddingHorizontal: space.xl,
  },
});

export { fonts };
