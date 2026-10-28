import { useId } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { LOGO } from '../lib/logo';
import { usePalette } from '../theme';
import { Txt } from './ui';

/*
 * The Kharcha wallet: two bills tucked into a wallet, and a clasp with a coin.
 * Shapes live in lib/logo.ts (shared with the app icon files); colours come from
 * the theme (palette.logo), so the logo follows your Electric / Midnight pick.
 */

/** The app icon as a rounded tile. From 48px up it gets a soft glow (dark) or drop shadow (light). */
export function LogoTile({ size = 40 }: { size?: number }) {
  const p = usePalette();
  const c = p.logo;
  const L = LOGO;
  // useId gives ":r1:"; gradient ids must be plain letters and digits.
  const id = `logo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const [ox, oy] = L.markOrigin;
  const halo =
    size >= 48
      ? {
          boxShadow:
            p.scheme === 'dark'
              ? `0px 0px ${Math.round(size * 0.32)}px ${c.glow}`
              : `0px ${Math.round(size * 0.1)}px ${Math.round(size * 0.3)}px ${c.glow}`,
        }
      : null;
  return (
    <View style={[{ width: size, height: size, borderRadius: size * (L.tile.r / L.size) }, halo]} accessible accessibilityRole="image" accessibilityLabel="Kharcha logo">
      <Svg width={size} height={size} viewBox="0 0 1024 1024">
        <Defs>
          <LinearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.tileTop} />
            <Stop offset="1" stopColor={c.tileBottom} />
          </LinearGradient>
          <LinearGradient id={`${id}w`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.walletTop} />
            <Stop offset="1" stopColor={c.walletBottom} />
          </LinearGradient>
        </Defs>
        <Rect
          x={L.tile.x}
          y={L.tile.y}
          width={L.tile.w}
          height={L.tile.h}
          rx={L.tile.r}
          fill={`url(#${id}t)`}
          stroke={c.tileBorder}
          // Keep the border about 1px on screen at any size.
          strokeWidth={Math.max(L.tile.border, (1024 / size) * 1)}
        />
        <G scale={L.markScale} origin={`${ox}, ${oy}`}>
          <G rotation={L.billBack.rotate} origin={L.billBack.origin.join(', ')}>
            <Rect x={L.billBack.x} y={L.billBack.y} width={L.billBack.w} height={L.billBack.h} rx={L.billBack.r} fill={c.billBack} />
          </G>
          <G rotation={L.billFront.rotate} origin={L.billFront.origin.join(', ')}>
            <Rect x={L.billFront.x} y={L.billFront.y} width={L.billFront.w} height={L.billFront.h} rx={L.billFront.r} fill={c.billFront} />
            <Circle cx={L.billCoin.cx} cy={L.billCoin.cy} r={L.billCoin.r} fill={c.billCoin} />
          </G>
          <Rect
            x={L.wallet.x}
            y={L.wallet.y + L.walletShadowDrop}
            width={L.wallet.w}
            height={L.wallet.h}
            rx={L.wallet.r}
            fill={c.walletShadow}
            opacity={c.walletShadowOpacity}
          />
          <Rect x={L.wallet.x} y={L.wallet.y} width={L.wallet.w} height={L.wallet.h} rx={L.wallet.r} fill={`url(#${id}w)`} />
          <Path d={L.clasp} fill={c.clasp} />
          <Circle cx={L.dot.cx} cy={L.dot.cy} r={L.dot.r} fill={c.dot} />
        </G>
      </Svg>
    </View>
  );
}

/** Tile plus the name, for the top of Home. The dot after the name is the brand coin. */
export function Wordmark({ size = 32 }: { size?: number }) {
  const p = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: size * 0.3 }} accessibilityRole="header" accessibilityLabel="Kharcha">
      <LogoTile size={size} />
      <Txt variant="title" style={{ fontSize: size * 0.68, lineHeight: size * 0.9, letterSpacing: -0.7 }} color={p.ink}>
        Kharcha
        <Txt variant="title" style={{ fontSize: size * 0.68, lineHeight: size * 0.9 }} color={p.accentInk}>
          .
        </Txt>
      </Txt>
    </View>
  );
}
