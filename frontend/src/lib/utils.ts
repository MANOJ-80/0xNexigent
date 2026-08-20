/** Format USD amounts with dynamic precision */
export const money = (value: number | undefined | null) => {
  const v = Number(value || 0);
  if (v === 0) return '$0.00';
  if (v >= 0.01) return `$${v.toFixed(2)}`;
  if (v >= 0.0001) return `$${v.toFixed(4)}`;
  const str = v.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return `$${str}`;
};

/** Display percentage with dynamic precision */
export const displayPercent = (used: number, limit: number) => {
  if (!limit || limit <= 0 || !used || used <= 0) return '0%';
  const pct = (used / limit) * 100;
  if (pct >= 100) return '100%';
  if (pct >= 10) return `${(Math.round(pct * 10) / 10).toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  const str = pct.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
  return `${str}%`;
};

/** Budget health state based on percentage */
export const budgetState = (percent: number) =>
  percent >= 100 ? 'red' : percent >= 80 ? 'amber' : 'green';
