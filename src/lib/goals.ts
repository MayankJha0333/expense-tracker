import { inr } from './money';
import type { Goal } from './types';

const MONTH_MS = 30.44 * 86_400_000;

/** What it takes to reach the goal on time, in plain words. */
export function goalPlan(g: Goal): string {
  const left = g.target - g.saved;
  if (left <= 0) return 'Reached. Well done!';
  if (!g.deadline) return `${inr(left)} to go`;
  const months = (g.deadline - Date.now()) / MONTH_MS;
  const by = new Date(g.deadline).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  if (months < 0.5) return `${inr(left)} to go, due ${by}`;
  return `About ${inr(left / Math.max(1, Math.round(months)))} a month to reach it by ${by}`;
}
