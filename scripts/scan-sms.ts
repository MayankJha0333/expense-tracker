/*
 * Run your phone's real SMS through Kharcha's parser, on your Mac. Nothing leaves your computer.
 *
 * 1. Phone plugged in with USB debugging on, then:
 *      adb shell content query --uri content://sms/inbox --projection address:date:body > private/sms-dump.txt
 * 2. npm run scan:sms
 *
 * Writes (all inside private/, which git ignores):
 *   private/sms-parsed.txt          every payment the app found: check amounts, shops, categories
 *   private/sms-misses.txt          money-looking messages the app skipped (likely parser gaps)
 *   private/sms-misses-redacted.txt same, with every digit turned into 7 — safe to paste to Claude
 *   private/inbox.json              the last 13 months, ready to load into a development build:
 *
 * See it in the emulator (development build running with Metro):
 *   python3 -m http.server 8099 --bind 127.0.0.1 --directory private
 *   then, in the app's JS debugger:
 *   fetch('http://10.0.2.2:8099/inbox.json').then((r) => r.json())
 *     .then((d) => { globalThis.__KHARCHA_TEST_INBOX__ = d; return globalThis.__KHARCHA_RESCAN__(); });
 *   (10.0.2.2 is the Mac as seen from the emulator. Release builds ignore all of this.)
 * Personal numbers (+91 98...) are dropped first, exactly like the app does.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { findMoney, parseSms, type RawSms } from '../src/lib/parser';
import { processInbox } from '../src/lib/pipeline';

const DUMP = process.argv[2] ?? 'private/sms-dump.txt';
if (!existsSync(DUMP)) {
  console.error(`No dump at ${DUMP}. Run:\n  adb shell content query --uri content://sms/inbox --projection address:date:body > ${DUMP}`);
  process.exit(1);
}

// Same rule as the native module: 10+ digit senders are people, not banks.
const PERSONAL = /^\+?\d{10,}$/;

function readDump(path: string): RawSms[] {
  const text = readFileSync(path, 'utf8').replace(/\r/g, '');
  const rows = text.split(/^Row: \d+ /m).filter((r) => r.trim());
  const out: RawSms[] = [];
  rows.forEach((row, i) => {
    const m = /^address=(.*?), date=(\d+), body=([\s\S]*)$/.exec(row.replace(/\n$/, ''));
    if (!m) return;
    out.push({ id: String(i), sender: m[1] === 'NULL' ? '' : m[1], date: Number(m[2]), body: m[3] });
  });
  return out;
}

const all = readDump(DUMP);
if (all.length === 0) {
  console.error(`${DUMP} has no messages. Check that "adb devices" lists your phone, then export again:\n  adb shell content query --uri content://sms/inbox --projection address:date:body > ${DUMP}`);
  process.exit(1);
}
const personal = all.filter((s) => !s.sender || PERSONAL.test(s.sender.replace(/[\s-]/g, '')));
const inbox = all.filter((s) => !personal.includes(s));
const { txns, stats, bills } = processInbox(inbox, { personal: personal.length });

const MONEY_WORD = /\b(debited|credited|spent|paid|sent|received|withdrawn|purchase|txn|transaction)\b/i;
const misses = inbox.filter((s) => {
  const r = parseSms(s);
  return !r.ok && r.reason === 'not_transaction' && findMoney(s.body) !== null && MONEY_WORD.test(s.body);
});

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const one = (s: string) => s.replace(/\s+/g, ' ').trim();

// Same shape the app's SMS reader returns, for loading into a development build (see the header).
const MONTHS_BACK = 13;
const since = new Date();
since.setMonth(since.getMonth() - MONTHS_BACK, 1);
since.setHours(0, 0, 0, 0);
const recent = inbox.filter((s) => s.date >= since.getTime());
writeFileSync(
  'private/inbox.json',
  JSON.stringify({ messages: recent, scanned: recent.length + personal.length, personalSkipped: personal.length }),
);

writeFileSync(
  'private/sms-parsed.txt',
  txns
    .map((t) => `${day(t.timestamp)}  ${t.type.padEnd(6)} ${String(t.amount).padStart(10)}  ${t.merchant.padEnd(28)} ${t.category.padEnd(13)} ${t.mode.padEnd(10)} ${t.sender ?? ''}\n    ${one(t.rawSms ?? '')}`)
    .join('\n\n') + '\n',
);
const missText = misses.map((s) => `${day(s.date)}  ${s.sender}\n    ${one(s.body)}`).join('\n\n') + '\n';
writeFileSync('private/sms-misses.txt', missText);
writeFileSync('private/sms-misses-redacted.txt', missText.replace(/\d/g, '7'));

console.log(`Messages read:        ${all.length}`);
console.log(`Personal (dropped):   ${personal.length}`);
console.log(`Payments found:       ${stats.kept}`);
console.log(`Card bills found:     ${bills.length}`);
console.log(`Skipped:              ${JSON.stringify(stats.skipped)}`);
console.log(`Possible misses:      ${misses.length}`);
console.log(`\nCheck private/sms-parsed.txt for wrong amounts/shops/categories,`);
console.log(`and private/sms-misses-redacted.txt for payments the app did not catch.`);
