import { useEffect, useRef, useState } from 'react';
import type { TextProps } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { easeOutCubic, MOTION } from '../lib/motion';
import type { TypeVariant } from '../theme';
import { Txt } from './ui';

/**
 * A number that counts from its old value to the new one (from 0 on first show).
 * [format] turns the number into text, e.g. (v) => money(v). Screen readers get the final value.
 */
export function AnimatedAmount({
  value,
  format,
  variant = 'body',
  duration = MOTION.fill,
  ...rest
}: Omit<TextProps, 'children'> & {
  value: number;
  format: (v: number) => string;
  variant?: TypeVariant;
  duration?: number;
  color?: string;
  tabular?: boolean;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? value : 0);
  const from = useRef(reduced ? value : 0);
  useEffect(() => {
    if (reduced || !Number.isFinite(value)) {
      from.current = value;
      const id = requestAnimationFrame(() => setShown(value));
      return () => cancelAnimationFrame(id);
    }
    const start = from.current;
    const t0 = Date.now();
    let frame = 0;
    const tick = () => {
      const t = (Date.now() - t0) / duration;
      const v = start + (value - start) * easeOutCubic(t);
      setShown(t >= 1 ? value : v);
      if (t < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      from.current = value;
    };
  }, [value, reduced, duration]);
  return (
    <Txt variant={variant} accessibilityLabel={format(value)} {...rest}>
      {format(shown)}
    </Txt>
  );
}
