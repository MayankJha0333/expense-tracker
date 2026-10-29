/*
 * Run: npx tsx scripts/bump-version.ts <patch|minor|major> [--commit] [--push]
 *
 * Raises the app version everywhere it lives, following the build-number rule (docs/RELEASING.md):
 *   app.json            expo.version (1.0.2 → 1.0.3) and expo.android.versionCode (1003 → 1004)
 *   package.json        version
 *   package-lock.json   the root package's version
 *
 *   patch / minor  versionCode + 1, same thousand           1.0.2 (1003) → 1.0.3 (1004) / 1.1.0 (1004)
 *   major          versionCode jumps to the next thousand   1.4.0 (1020) → 2.0.0 (2001), which makes
 *                  older apps ask people to update
 *
 * --commit  also commits "Release x.y.z" and tags it vx.y.z
 * --push    also pushes the commit and the tag (the tag starts the Play release workflow)
 *
 * Prints the new version on the last line, so CI can read it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { MAJOR_STEP, majorOf } from '../src/lib/versionRule';

type Kind = 'patch' | 'minor' | 'major';
const KINDS: Kind[] = ['patch', 'minor', 'major'];

const args = process.argv.slice(2);
const kind = args.find((a) => !a.startsWith('--')) as Kind | undefined;
const commit = args.includes('--commit') || args.includes('--push');
const push = args.includes('--push');

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!kind || !KINDS.includes(kind)) fail(`Say which kind of release: ${KINDS.join(', ')}. Example: npx tsx scripts/bump-version.ts patch`);

const root = new URL('../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root), 'utf8');
const write = (file: string, text: string) => writeFileSync(new URL(file, root), text);

const appText = read('app.json');
const app = JSON.parse(appText);
const current: string = app.expo.version;
const currentCode: number = app.expo.android?.versionCode;
const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(current ?? '');
if (!m) fail(`app.json "version" must look like 1.2.3 (found ${JSON.stringify(current)}).`);
if (!Number.isInteger(currentCode)) fail('app.json "android.versionCode" must be a whole number.');
const [major, minor, patch] = [Number(m[1]), Number(m[2]), Number(m[3])];
if (majorOf(currentCode) !== major) fail(`versionCode ${currentCode} doesn't match version ${current}. Fix app.json first (npm run check:version).`);

const next = kind === 'major' ? `${major + 1}.0.0` : kind === 'minor' ? `${major}.${minor + 1}.0` : `${major}.${minor}.${patch + 1}`;
const nextCode = kind === 'major' ? (major + 1) * MAJOR_STEP + 1 : currentCode + 1;
if (kind !== 'major' && majorOf(nextCode) !== major) fail(`No build numbers left for ${major}.x (versionCode ${currentCode}). Release a major version instead.`);

// Change only the two values, so the rest of each file (order, spacing) stays exactly as it is.
const replaceOnce = (text: string, pattern: RegExp, value: string, file: string) => {
  if (!pattern.test(text)) fail(`Couldn't find the version in ${file}.`);
  return text.replace(pattern, value);
};
let nextApp = replaceOnce(appText, /("version"\s*:\s*)"[^"]*"/, `$1"${next}"`, 'app.json');
nextApp = replaceOnce(nextApp, /("versionCode"\s*:\s*)\d+/, `$1${nextCode}`, 'app.json');
write('app.json', nextApp);

write('package.json', replaceOnce(read('package.json'), /("version"\s*:\s*)"[^"]*"/, `$1"${next}"`, 'package.json'));

// package-lock.json: the root package appears twice at the top ("version" and packages[""].version).
const lock = read('package-lock.json');
const lockJson = JSON.parse(lock);
lockJson.version = next;
if (lockJson.packages?.['']) lockJson.packages[''].version = next;
write('package-lock.json', `${JSON.stringify(lockJson, null, 2)}\n`);

console.log(`✓ ${current} (${currentCode}) → ${next} (${nextCode})`);

if (commit) {
  const git = (...a: string[]) => execFileSync('git', a, { stdio: 'inherit', cwd: fileURLToPath(root) });
  git('add', 'app.json', 'package.json', 'package-lock.json');
  git('commit', '-m', `Release ${next}`);
  git('tag', `v${next}`);
  console.log(`✓ committed and tagged v${next}`);
  if (push) {
    git('push');
    git('push', 'origin', `v${next}`);
    console.log(`✓ pushed: the release workflow will build v${next} and send it to Google Play`);
  }
}

console.log(next);
