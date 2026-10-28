/** Indian rupee formatting: ₹1,23,456 and short forms like ₹1.2L. */

/** 1234567 → "12,34,567" */
export function group(n: number): string {
  const s = Math.trunc(Math.abs(n)).toString();
  if (s.length <= 3) return s;
  const last3 = s.slice(-3);
  let rest = s.slice(0, -3);
  const parts: string[] = [];
  while (rest.length > 2) {
    parts.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) parts.unshift(rest);
  return `${parts.join(',')},${last3}`;
}

export function inr(amount: number, opts: { decimals?: boolean } = {}): string {
  const negative = amount < 0;
  const v = Math.abs(amount);
  let text: string;
  if (opts.decimals) {
    const paise = Math.round(v * 100);
    const rupees = Math.floor(paise / 100);
    const rest = paise % 100;
    text = group(rupees) + (rest === 0 ? '' : '.' + String(rest).padStart(2, '0'));
  } else {
    text = group(Math.round(v));
  }
  return (negative ? '-₹' : '₹') + text;
}

const trim1 = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

export function inrCompact(amount: number): string {
  const v = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (v < 1_000) return `${sign}₹${Math.round(v)}`;
  if (v < 1_00_000) return `${sign}₹${trim1(v / 1_000)}k`;
  if (v < 1_00_00_000) return `${sign}₹${trim1(v / 1_00_000)}L`;
  return `${sign}₹${trim1(v / 1_00_00_000)}Cr`;
}

export function percent(v: number): string {
  if (v > 0 && v < 0.01) return '<1%';
  return `${Math.round(v * 100)}%`;
}
