/*
 * The wallet logo's shapes on a 1024 × 1024 grid. Pure data, no React:
 * components/Logo.tsx draws it in the app, scripts/make-icons.ts turns it into
 * the app icon PNGs, so the two can never drift apart.
 */
import type { LogoColors } from './palette';

export const LOGO = {
  size: 1024,
  tile: { x: 8, y: 8, w: 1008, h: 1008, r: 232, border: 16 },
  /** The whole mark is drawn a little bigger than its grid, around this point. */
  markScale: 1.08,
  markOrigin: [512, 530] as const,
  billBack: { x: 236, y: 250, w: 400, h: 260, r: 44, rotate: -20, origin: [430, 390] as const },
  billFront: { x: 330, y: 236, w: 420, h: 270, r: 44, rotate: -9, origin: [540, 380] as const },
  billCoin: { cx: 560, cy: 340, r: 62 },
  wallet: { x: 196, y: 440, w: 632, h: 384, r: 104 },
  walletShadowDrop: 26,
  /** Clasp: round on the left, softer corners on the right; sticks out past the wallet a little. */
  clasp: 'M708 556 H812 a48 48 0 0 1 48 48 V660 a48 48 0 0 1 -48 48 H708 a76 76 0 0 1 0 -152 Z',
  dot: { cx: 716, cy: 632, r: 40 },
};

type SvgOptions = {
  /** Draw the rounded tile behind the mark. */
  tile?: boolean;
  /** Fill the whole square (for app icons the system crops itself). */
  fullBleed?: boolean;
  /** Extra scale for the mark only (adaptive icons need it inside the safe zone). */
  markScale?: number;
  /** Single-colour silhouette with cut-outs (Android themed icons). */
  mono?: boolean;
  id?: string;
};

/** The logo as an SVG string. */
export function logoSvg(c: LogoColors, o: SvgOptions = {}): string {
  const L = LOGO;
  const id = o.id ?? 'k';
  const scale = L.markScale * (o.markScale ?? 1);
  const [ox, oy] = L.markOrigin;
  const rect = (r: { x: number; y: number; w: number; h: number; r: number }, fill: string, extra = '') =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${r.r}" fill="${fill}"${extra}/>`;
  const bg = o.fullBleed
    ? `<rect width="1024" height="1024" fill="url(#${id}t)"/>`
    : o.tile
      ? `<rect x="${L.tile.x}" y="${L.tile.y}" width="${L.tile.w}" height="${L.tile.h}" rx="${L.tile.r}" fill="url(#${id}t)" stroke="${c.tileBorder}" stroke-width="${L.tile.border}"/>`
      : '';
  if (o.mono) {
    // Only the shape matters: white shapes, with the coins and the clasp edge cut out.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs><mask id="${id}m"><rect width="1024" height="1024" fill="#fff"/>
    <g transform="translate(${ox} ${oy}) scale(${scale}) translate(${-ox} ${-oy})">
      <g transform="rotate(${L.billFront.rotate} ${L.billFront.origin.join(' ')})"><circle cx="${L.billCoin.cx}" cy="${L.billCoin.cy}" r="${L.billCoin.r}" fill="#000"/></g>
      ${rect({ ...L.wallet, x: L.wallet.x - 18, y: L.wallet.y - 18, w: L.wallet.w + 36, h: L.wallet.h + 36, r: L.wallet.r + 18 }, '#000')}
      ${rect(L.wallet, '#fff')}
      <path d="${L.clasp}" fill="#000" transform="translate(-14 -14) scale(1.03)"/>
      <path d="${L.clasp}" fill="#fff"/>
      <circle cx="${L.dot.cx}" cy="${L.dot.cy}" r="${L.dot.r}" fill="#000"/>
    </g></mask></defs>
  <g mask="url(#${id}m)" fill="#fff">
    <g transform="translate(${ox} ${oy}) scale(${scale}) translate(${-ox} ${-oy})">
      <g transform="rotate(${L.billBack.rotate} ${L.billBack.origin.join(' ')})">${rect(L.billBack, '#fff')}</g>
      <g transform="rotate(${L.billFront.rotate} ${L.billFront.origin.join(' ')})">${rect(L.billFront, '#fff')}</g>
      ${rect(L.wallet, '#fff')}
      <path d="${L.clasp}" fill="#fff"/>
    </g>
  </g>
</svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.tileTop}"/><stop offset="1" stop-color="${c.tileBottom}"/></linearGradient>
    <linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.walletTop}"/><stop offset="1" stop-color="${c.walletBottom}"/></linearGradient>
  </defs>
  ${bg}
  <g transform="translate(${ox} ${oy}) scale(${scale}) translate(${-ox} ${-oy})">
    <g transform="rotate(${L.billBack.rotate} ${L.billBack.origin.join(' ')})">${rect(L.billBack, c.billBack)}</g>
    <g transform="rotate(${L.billFront.rotate} ${L.billFront.origin.join(' ')})">${rect(L.billFront, c.billFront)}<circle cx="${L.billCoin.cx}" cy="${L.billCoin.cy}" r="${L.billCoin.r}" fill="${c.billCoin}"/></g>
    ${rect({ ...L.wallet, y: L.wallet.y + L.walletShadowDrop }, c.walletShadow, ` opacity="${c.walletShadowOpacity}"`)}
    ${rect(L.wallet, `url(#${id}w)`)}
    <path d="${L.clasp}" fill="${c.clasp}"/>
    <circle cx="${L.dot.cx}" cy="${L.dot.cy}" r="${L.dot.r}" fill="${c.dot}"/>
  </g>
</svg>`;
}
