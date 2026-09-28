// Number formatting shared by server and client. Empty string when there is no value.
export const pct = (n: number | null | undefined) => (n == null ? '' : `${(n * 100).toFixed(n * 100 >= 10 ? 0 : 1)}%`);
export const num = (n: number | null | undefined) => (n == null ? '' : new Intl.NumberFormat('en-US').format(Math.round(n)));
export const money = (n: number | null | undefined) => (n == null ? '' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n));
