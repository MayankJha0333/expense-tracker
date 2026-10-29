import * as Haptics from 'expo-haptics';
import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { purposesFor } from '../lib/purposes';
import { useStore } from '../lib/store';
import type { PurposeId, Txn } from '../lib/types';
import { space } from '../theme';
import { Chip } from './ui';

/**
 * "Room rent", "Cook", "Lent money"... for a person you pay, or "Lent money back",
 * "Interest received"... for a person who paid you. Picking one moves every
 * payment to them into the matching category. Tap the picked one again to clear it.
 * [row] = one line that scrolls sideways (for lists); otherwise the chips wrap.
 */
export function PurposePicker({ txn, row }: { txn: Txn; row?: boolean }) {
  const { setPurpose } = useStore();
  const lastTap = useRef(0);
  const pick = (id: PurposeId) => {
    // Moving every payment takes a moment on big inboxes; a quick second tap would undo the first.
    const now = new Date().getTime();
    if (now - lastTap.current < 1200) return;
    lastTap.current = now;
    Haptics.selectionAsync().catch(() => {});
    setPurpose(txn, txn.purpose === id ? null : id);
  };
  const chips = purposesFor(txn.type).map((x) => (
    <Chip
      key={x.id}
      label={x.label}
      icon={x.icon}
      a11y={`${x.label}${txn.purpose === x.id ? ', picked. Tap to clear' : ''}`}
      selected={txn.purpose === x.id}
      onPress={() => pick(x.id)}
    />
  ));
  if (row) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {chips}
      </ScrollView>
    );
  }
  return <View style={styles.wrap}>{chips}</View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm, paddingRight: space.lg },
});
