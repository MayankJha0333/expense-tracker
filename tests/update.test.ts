/* Run: npx vitest run tests/update.test.ts — the rule that decides when an update is required. */
import { majorOf, toVersionCode, updateKind } from '../src/lib/versionRule';

import { eq } from './check';


eq('1001 is major 1', majorOf(1001), 1);
eq('2001 is major 2', majorOf(2001), 2);
eq('1999 is still major 1', majorOf(1999), 1);

eq('same build: no update', updateKind(1001, 1001), 'none');
eq('older store build (rollback, staged release): no update', updateKind(1005, 1003), 'none');
eq('1.x → newer 1.x: small update, never forced', updateKind(1001, 1002), 'minor');
eq('1.x → 2.0: major update, forced', updateKind(1007, 2001), 'major');
eq('skipping a major (1.x → 3.x): forced', updateKind(1007, 3002), 'major');
eq('2.x → newer 2.x: small update', updateKind(2001, 2004), 'minor');
eq('unknown installed build: never forced', updateKind(null, 2001), 'none');
eq('unknown store build: never forced', updateKind(1001, null), 'none');

eq('"2001" (string from Play) → 2001', toVersionCode('2001'), 2001);
eq('number stays a number', toVersionCode(1001), 1001);
eq('" 1002 " with spaces → 1002', toVersionCode(' 1002 '), 1002);
eq('version name "2.0.0" is not a build number', toVersionCode('2.0.0'), null);
eq('empty → null', toVersionCode(''), null);
eq('null → null', toVersionCode(null), null);
eq('0 → null', toVersionCode(0), null);

