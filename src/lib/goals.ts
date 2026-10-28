import { monthYear } from './analytics';
import { money } from './money';
import type { Goal } from './types';

const MONTH_MS = 30.44 * 86_400_000;

/** What it takes to reach the goal on time, in plain words. */
export function goalPlan(g: Goal): string {
  const left = g.target - g.saved;
  if (left <= 0) return 'Reached. Well done!';
  if (!g.deadline) return `${money(left)} to go`;
  const months = (g.deadline - Date.now()) / MONTH_MS;
  const by = monthYear(g.deadline);
  if (months < 0) return `${money(left)} to go, date passed (${by})`;
  if (months < 0.5) return `${money(left)} to go, due ${by}`;
  return `About ${money(left / Math.max(1, Math.round(months)))} a month to reach it by ${by}`;
}
