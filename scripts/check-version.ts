/*
 * Run: npx tsx scripts/check-version.ts [tag]
 * Guards the build-number rule (docs/RELEASING.md) before a release:
 * - app.json `version` is x.y.z and `android.versionCode` is a whole number
 * - versionCode is in the right thousand for the major version (1.x → 1001…1999)
 * - when a tag is given (v1.2.3), it matches `version`
 */
import { readFileSync } from 'node:fs';

import { majorOf, MAJOR_STEP } from '../src/lib/versionRule';

const app = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;
const version: string = app.version;
const versionCode: number = app.android?.versionCode;
const tag = process.argv[2];

const problems: string[] = [];
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');
if (!m) problems.push(`app.json "version" must look like 1.2.3 (found ${JSON.stringify(version)}).`);
if (!Number.isInteger(versionCode) || versionCode <= 0) problems.push(`app.json "android.versionCode" must be a whole number (found ${JSON.stringify(versionCode)}).`);

if (m && Number.isInteger(versionCode)) {
  const major = Number(m[1]);
  if (majorOf(versionCode) !== major) {
    const from = major * MAJOR_STEP + 1;
    problems.push(`versionCode ${versionCode} doesn't match version ${version}: a ${major}.x build needs a versionCode from ${from} to ${from + MAJOR_STEP - 2}.`);
  }
}
if (tag && tag.startsWith('v') && tag !== `v${version}`) problems.push(`Tag ${tag} doesn't match app.json version ${version}. Tag the release as v${version}.`);

if (problems.length) {
  console.error(problems.map((p) => `✗ ${p}`).join('\n'));
  process.exit(1);
}
console.log(`✓ version ${version}, versionCode ${versionCode}${tag ? `, tag ${tag}` : ''}`);
