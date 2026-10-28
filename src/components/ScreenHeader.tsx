import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { IconName } from '../lib/types';
import { space, usePalette } from '../theme';
import { Icon, Txt } from './ui';

/** Back (or close) button with an optional small title. */
export function ScreenHeader({ title, close }: { title?: string; close?: boolean }) {
  const p = usePalette();
  const icon: IconName = close ? 'close' : 'chevron-left';
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={close ? 'Close' : 'Back'}
        style={[styles.btn, { backgroundColor: p.surface, borderColor: p.line }]}
      >
        <Icon name={icon} size={22} />
      </Pressable>
      {title ? (
        <Txt variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {title}
        </Txt>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
