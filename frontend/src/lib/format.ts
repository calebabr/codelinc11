// Formatting only. Never compute dollar amounts here.

const whole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const cents = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** $1,405 (no cents unless needed). */
export function money(n: number): string {
  if (!Number.isFinite(n)) return '$0'
  return Number.isInteger(n) ? whole.format(n) : cents.format(n)
}

/** 0.8 -> "80%" */
export function pct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function monthName(m: number): string {
  return MONTHS[(((m - 1) % 12) + 12) % 12]
}

export function monthShort(m: number): string {
  return monthName(m).slice(0, 3)
}

export const MONTH_OPTIONS = MONTHS.map((name, i) => ({ value: i + 1, label: name }))

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many
}
