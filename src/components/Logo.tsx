import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { usePalette } from '../theme';
import { Txt } from './ui';

/*
 * The Kharcha mark: a "K" made of a ledger line (white stem) and a "spend less"
 * arrow (the < chevron) in the accent colour. Same geometry as assets/icon.png
 * (1024 grid), so the app icon and the in-app logo always match.
 */
function Mark({ stem, chevron }: { stem: string; chevron: string }) {
  return (
    <>
      <Rect x={276} y={256} width={136} height={512} rx={68} fill={stem} />
      <Path d="M680 290 L488 512 L680 734" fill="none" stroke={chevron} strokeWidth={136} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

/** The app icon as a rounded tile, in the current accent. */
export function LogoTile({ size = 40 }: { size?: number }) {
  const p = usePalette();
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024" accessibilityLabel="Kharcha">
      <Rect width={1024} height={1024} rx={236} fill={p.logoTile} />
      <Mark stem={p.logoStem} chevron={p.logoArrow} />
    </Svg>
  );
}

/** Tile plus the name, for the top of Home and the welcome screen. */
export function Wordmark({ size = 32 }: { size?: number }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }} accessibilityRole="header" accessibilityLabel="Kharcha">
      <LogoTile size={size} />
      <Txt variant="title" style={{ fontSize: size * 0.66, lineHeight: size * 0.9, letterSpacing: -0.6 }} color={p.ink}>
        Kharcha
        <Txt variant="title" style={{ fontSize: size * 0.66, lineHeight: size * 0.9 }} color={p.accentInk}>
          .
        </Txt>
      </Txt>
    </View>
  );
}
