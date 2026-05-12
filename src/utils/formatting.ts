export function fmt(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-9) return '0';
  if (Math.abs(value) >= 1e5 || Math.abs(value) < 1e-3) {
    return value.toExponential(digits);
  }
  const fixed = value.toFixed(digits);
  // Trim trailing zeros
  return fixed.replace(/\.?0+$/, '');
}

export function fmtFixed(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function fmtSci(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return value.toExponential(digits);
}
