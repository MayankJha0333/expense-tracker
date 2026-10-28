import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { monthShort, type FlowMonth } from '../lib/analytics';
import { money, moneyCompact } from '../lib/money';
import { alpha, space, usePalette } from '../theme';
import { useFill } from './motion';
import { Txt } from './ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/** A bar that grows up to [height] when it first shows (and glides to new heights). */
export function GrowBar({ height, index = 0, style }: { height: number; index?: number; style?: StyleProp<ViewStyle> }) {
  const h = useFill(height, 120 + index * 45);
  const grow = useAnimatedStyle(() => ({ height: h.get() }));
  return <Animated.View style={[style, grow]} />;
}

/** One coloured arc of a Donut; [t] goes 0 → 1 to draw the ring in. */
function DonutSlice({ cx, r, c, len, start, color, thickness, t }: { cx: number; r: number; c: number; len: number; start: number; color: string; thickness: number; t: SharedValue<number> }) {
  const props = useAnimatedProps(() => {
    const dash = Math.max(0, len * t.get());
    return { strokeDasharray: [dash, c - dash], strokeDashoffset: -start * t.get() };
  });
  return <AnimatedCircle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={thickness} fill="none" animatedProps={props} />;
}

/** Ring split into coloured arcs, biggest first. Something can sit in the middle. */
export function Donut({
  slices,
  size = 160,
  thickness = 18,
  children,
}: {
  slices: { value: number; color: string }[];
  size?: number;
  thickness?: number;
  children?: ReactNode;
}) {
  const p = usePalette();
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((a, s) => a + s.value, 0);
  const gap = slices.length > 1 ? 3 : 0;
  const t = useFill(1);
  let offset = 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={p.track} strokeWidth={thickness} fill="none" />
          {total > 0
            ? slices.map((s, i) => {
                const len = (s.value / total) * c;
                const dash = Math.max(0, len - gap);
                const el = <DonutSlice key={i} cx={size / 2} r={r} c={c} len={dash} start={offset} color={s.color} thickness={thickness} t={t} />;
                offset += len;
                return el;
              })
            : null}
        </G>
      </Svg>
      {children}
    </View>
  );
}

/** Progress ring (0..1). Over 1 wraps fully and turns the warning colour. */
export function Ring({
  progress,
  size = 64,
  thickness = 7,
  color,
  track,
  children,
}: {
  progress: number;
  size?: number;
  thickness?: number;
  color: string;
  track?: string;
  children?: ReactNode;
}) {
  const p = usePalette();
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  // Sweeps round from empty when it first shows, then glides to new values.
  const fill = useFill(shown, 150);
  const arc = useAnimatedProps(() => ({
    strokeDashoffset: c * (1 - fill.get()),
    strokeOpacity: fill.get() > 0.002 ? 1 : 0,
  }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={track ?? p.track} strokeWidth={thickness} fill="none" />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={[c, c]}
            animatedProps={arc}
          />
        </G>
      </Svg>
      {children}
    </View>
  );
}

/**
 * Money in (mint) next to money out (saffron) for each month.
 * Tap a month to select it. The selected month is fully coloured.
 */
export function CashflowBars({
  data,
  selected,
  onSelect,
  height = 132,
}: {
  data: FlowMonth[];
  selected: number;
  onSelect?: (i: number) => void;
  height?: number;
}) {
  const p = usePalette();
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.spent)));
  const bar = (v: number) => (v > 0 ? Math.max(4, (v / max) * height) : 2);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        {data.map((d, i) => {
          const on = i === selected;
          return (
            <Pressable
              key={i}
              onPress={() => onSelect?.(i)}
              disabled={!onSelect}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${monthShort(d.month)}: ${money(d.income)} in, ${money(d.spent)} out`}
              style={[styles.flowCol, on && { backgroundColor: alpha(p.ink, 0.05) }]}
            >
              <View style={[styles.pair, { height }]}>
                <GrowBar index={i * 2} height={bar(d.income)} style={[styles.flowBar, { backgroundColor: on ? p.income : alpha(p.income, 0.35) }]} />
                <GrowBar index={i * 2 + 1} height={bar(d.spent)} style={[styles.flowBar, { backgroundColor: on ? p.accent : alpha(p.accent, 0.35) }]} />
              </View>
              <Txt variant="tiny" color={on ? p.ink : p.muted}>
                {monthShort(d.month)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Line of how much was left each month, with zero marked. */
export function SavingsLine({ data, height = 96 }: { data: FlowMonth[]; height?: number }) {
  const p = usePalette();
  const [width, setWidth] = useState(0);
  const values = data.map((d) => d.saved);
  const hi = Math.max(0, ...values);
  const lo = Math.min(0, ...values);
  const span = Math.max(1, hi - lo);
  const pad = 10;
  const x = (i: number) => pad + (i * (width - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => pad + ((hi - v) / span) * (height - pad * 2);
  const points = values.map((v, i) => `${x(i)},${y(v)}`);
  const line = `M${points.join(' L')}`;
  const area = `${line} L${x(values.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z`;
  // Length of the line, so it can be drawn from left to right.
  let length = 0;
  for (let i = 1; i < values.length; i++) length += Math.hypot(x(i) - x(i - 1), y(values[i]) - y(values[i - 1]));
  const draw = useFill(width > 0 ? 1 : 0, 150);
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - draw.get()) }));
  const areaProps = useAnimatedProps(() => ({ fillOpacity: draw.get() }));

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && values.length > 1 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="save" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={p.savings} stopOpacity={0.28} />
              <Stop offset="1" stopColor={p.savings} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {lo < 0 ? <Line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke={p.line} strokeDasharray="4 4" /> : null}
          <AnimatedPath d={area} fill="url(#save)" animatedProps={areaProps} />
          <AnimatedPath
            d={line}
            fill="none"
            stroke={p.savings}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={[length, length]}
            animatedProps={lineProps}
          />
          {values.map((v, i) => (
            <Circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 4.5 : 3} fill={v < 0 ? p.danger : p.savings} stroke={p.surface} strokeWidth={1.5} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

/** Legend dot + label + value, used under charts. */
export function LegendItem({ color, label, value }: { color: string; label: string; value?: number }) {
  const p = usePalette();
  return (
    <View style={styles.legend}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Txt variant="small" color={p.inkSoft}>
        {label}
      </Txt>
      {value !== undefined ? (
        <Txt variant="smallStrong" tabular>
          {moneyCompact(value)}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flowCol: { flex: 1, alignItems: 'center', gap: 6, paddingTop: 6, paddingBottom: 4, borderRadius: 10 },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  flowBar: { width: 9, borderRadius: 5 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 3 },
});
