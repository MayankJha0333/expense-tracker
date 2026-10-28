/// <reference types="node" />
/* Writes PRIVACY.md from src/lib/policy.ts, so the store copy matches the in-app one. Run: npm run privacy:md */
import { writeFileSync } from 'fs';
import { join } from 'path';

import { POLICY, POLICY_SUMMARY, POLICY_UPDATED } from '../src/lib/policy';

const md = [
  '# Kharcha privacy policy',
  '',
  `_Last updated ${POLICY_UPDATED}_`,
  '',
  `> ${POLICY_SUMMARY}`,
  '',
  ...POLICY.flatMap((s) => [`## ${s.title}`, '', ...s.body.flatMap((p) => [p, '']), '']),
]
  .join('\n')
  .replace(/\n{3,}/g, '\n\n');

writeFileSync(join(__dirname, '..', 'PRIVACY.md'), md);
console.log('PRIVACY.md written');
