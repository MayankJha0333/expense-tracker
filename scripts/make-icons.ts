/// <reference types="node" />
/*
 * Run: npx tsx scripts/make-icons.ts — writes the logo SVGs to assets/brand/.
 * The PNG app icons in assets/ are rendered from these (1024 px, transparent where noted).
 * Launcher icon uses Electric Blue (light). The app itself redraws the logo in your colour.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { logoSvg } from '../src/lib/logo';
import { electricPalette, midnightPalette } from '../src/lib/palette';

const out = 'assets/brand';
mkdirSync(out, { recursive: true });
const blue = electricPalette('blue').logo;
const lime = midnightPalette('lime').logo;

const files: Record<string, string> = {
  // Square, edge to edge: the phone rounds the corners itself.
  'icon.svg': logoSvg(blue, { fullBleed: true, markScale: 0.92 }),
  // Android adaptive icon: the mark must sit inside the middle 66% (safe zone).
  'android-icon-foreground.svg': logoSvg(blue, { markScale: 0.62 }),
  'android-icon-background.svg': logoSvg(blue, { fullBleed: true }).replace(/<g transform="translate[\s\S]*<\/g>\n<\/svg>/, '</svg>'),
  'android-icon-monochrome.svg': logoSvg(blue, { mono: true, markScale: 0.62 }),
  // Splash and web: the rounded tile on a transparent background.
  'splash-icon.svg': logoSvg(blue, { tile: true }),
  'favicon.svg': logoSvg(blue, { tile: true }),
  // Dark version for docs, store listing and social.
  'logo-dark.svg': logoSvg(lime, { tile: true }),
  'logo-light.svg': logoSvg(blue, { tile: true }),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(`${out}/${name}`, svg);
console.log(`wrote ${Object.keys(files).length} files to ${out}`);
