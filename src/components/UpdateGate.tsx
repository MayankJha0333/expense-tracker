import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { checkStoreUpdate, startForcedUpdate, type UpdateStatus } from '../lib/appUpdate';
import { MOTION } from '../lib/motion';
import { space, usePalette } from '../theme';
import { LogoTile } from './Logo';
import { Button, Txt } from './ui';

const screenIn = FadeIn.duration(MOTION.base).reduceMotion(ReduceMotion.System);
const logoIn = ZoomIn.delay(120).springify().damping(14).stiffness(180).reduceMotion(ReduceMotion.System);

/**
 * Blocks the app when the Play Store has a new major version (see lib/versionRule.ts).
 * Checks on start and every time the app comes back to the front.
 * The first time, it opens Play's own full-screen update. If that is closed, this screen
 * stays on top with one button until the new version is installed. Small updates never block.
 */
export function UpdateGate() {
  const [required, setRequired] = useState<UpdateStatus | null>(null);
  const prompted = useRef(false);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const status = await checkStoreUpdate();
      if (!alive) return;
      const major = status.kind === 'major';
      setRequired(major ? status : null);
      if (major && !prompted.current) {
        prompted.current = true;
        startForcedUpdate(status.immediateAllowed);
      }
    };
    check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  // While the update is required, Back leaves the app instead of going to the screens underneath.
  useEffect(() => {
    if (!required) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      BackHandler.exitApp();
      return true;
    });
    return () => sub.remove();
  }, [required]);

  if (!required) return null;
  return <UpdateRequired onUpdate={() => startForcedUpdate(required.immediateAllowed)} />;
}

export function UpdateRequired({ onUpdate }: { onUpdate: () => void }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      entering={screenIn}
      accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.screen, { backgroundColor: p.bg, paddingTop: insets.top + space.xl, paddingBottom: insets.bottom + space.xl }]}
    >
      <View style={styles.middle}>
        <Animated.View entering={logoIn}>
          <LogoTile size={80} />
        </Animated.View>
        <View style={{ gap: space.sm }}>
          <Txt variant="title" style={{ textAlign: 'center' }} accessibilityRole="header">
            Time to update Kharcha
          </Txt>
          <Txt variant="body" color={p.inkSoft} style={{ textAlign: 'center' }}>
            A new version is ready on the Play Store. This version is no longer supported, so please update to keep using Kharcha.
          </Txt>
        </View>
        <Txt variant="small" color={p.muted} style={{ textAlign: 'center' }}>
          Your entries stay on this phone. Updating does not remove them.
        </Txt>
      </View>
      <Button label="Update now" icon="download" onPress={onUpdate} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: space.xl, zIndex: 100, elevation: 100 },
  middle: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
});
