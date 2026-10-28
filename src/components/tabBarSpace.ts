import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The floating tab bar: a pill that sits above the bottom edge of the screen. */
export const TAB_BAR = {
  /** Height of the pill. */
  height: 64,
  /** Gap to the left and right screen edges. */
  side: 16,
  /** Gap between the pill and the bottom edge (on top of the phone's own safe area). */
  lift: 10,
  /** Inner padding of the pill. */
  pad: 6,
} as const;

/** How far the bar's bottom edge sits from the bottom of the screen. */
export function tabBarBottom(insetBottom: number) {
  return Math.max(insetBottom, 8) + TAB_BAR.lift;
}

/** Space a tab screen leaves at the end of its scroll, so the last row can scroll clear of the floating bar. */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return tabBarBottom(insets.bottom) + TAB_BAR.height + 20;
}
