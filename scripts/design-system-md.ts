/* Run: npx tsx scripts/design-system-md.ts — rewrites the colour tables in docs/DESIGN_SYSTEM.md from src/lib/palette.ts. */
import { readFileSync, writeFileSync } from 'node:fs';

import { ELECTRIC_IDS, electricPalette, MIDNIGHT_IDS, midnightPalette, type Palette } from '../src/lib/palette';

const ROLES: [keyof Palette, string][] = [
  ['bg', 'Page background'],
  ['surface', 'Cards'],
  ['surfaceAlt', 'Chips, inputs, tracks'],
  ['line', 'Borders and dividers'],
  ['ink', 'Main text'],
  ['muted', 'Secondary text'],
  ['accent', 'Active tab, links, bars'],
  ['highlight', 'Hero chip, logo arrow'],
  ['hero', 'Hero card fill'],
  ['heroText', 'Text on hero'],
  ['fab', '+ button'],
  ['card', 'Deep slab (settings, account page)'],
  ['income', 'Money in'],
  ['warn', 'Due soon, needs a look'],
  ['danger', 'Late, over budget'],
];

function table(palettes: Palette[]): string {
  const head = `| Role | Used for | ${palettes.map((p) => p.familyName.replace(/^(Midnight|Electric) /, '')).join(' | ')} |`;
  const sep = `| --- | --- | ${palettes.map(() => '---').join(' | ')} |`;
  const rows = ROLES.map(([k, what]) => `| \`${k}\` | ${what} | ${palettes.map((p) => `\`${String(p[k])}\``).join(' | ')} |`);
  return [head, sep, ...rows].join('\n');
}

const file = 'docs/DESIGN_SYSTEM.md';
const doc = readFileSync(file, 'utf8');
const out = doc
  .replace(/<!-- midnight:start -->[\s\S]*<!-- midnight:end -->/, `<!-- midnight:start -->\n${table(MIDNIGHT_IDS.map(midnightPalette))}\n<!-- midnight:end -->`)
  .replace(/<!-- electric:start -->[\s\S]*<!-- electric:end -->/, `<!-- electric:start -->\n${table(ELECTRIC_IDS.map(electricPalette))}\n<!-- electric:end -->`);
writeFileSync(file, out);
console.log(`${file} updated`);
