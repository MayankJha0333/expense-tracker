import { Fragment, type ReactElement } from 'react';

import { useStore } from '../lib/store';

/**
 * Rebuilds a screen when the home currency or the month start day changes.
 *
 * Totals and amount text are worked out once and cached (useMemo and the React Compiler),
 * keyed on the payments, not on the currency. Without this, switching ₹ → $ in Settings
 * would leave old totals on screens that are still open.
 */
export function CurrencyScope({ children }: { children: ReactElement }) {
  const { currency, monthStart } = useStore();
  return <Fragment key={`${currency}:${monthStart}`}>{children}</Fragment>;
}

/** Screens that keep what the person typed or scrolled to, so they are never rebuilt. */
const KEEP = new Set(['(tabs)', 'settings', 'add', 'goal', 'budget', 'welcome']);

export function currencyLayout({ route, children }: { route: { name: string }; children: ReactElement }) {
  return KEEP.has(route.name) ? children : <CurrencyScope>{children}</CurrencyScope>;
}
