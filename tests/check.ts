/*
 * The two helpers every test file uses. Each call is one Vitest test, named by [name].
 * eq compares with JSON, like the old scripts did: undefined fields and key order don't matter.
 */
import { expect, test } from 'vitest';

export function check(name: string, ok: boolean, detail = '') {
  test(name, () => {
    expect(ok, detail || undefined).toBe(true);
  });
}

export function eq(name: string, got: unknown, want: unknown) {
  test(name, () => {
    expect(JSON.stringify(got)).toBe(JSON.stringify(want));
  });
}
