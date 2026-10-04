// Formatting only â€” no math. Dollar amounts come from the mock API already
// computed; this just presents them.

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
})

const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Format money. Shows cents only when the value isn't whole. */
export function money(n: number): string {
  if (typeof n !== "number" || !Number.isFinite(n)) return "—"
  return Number.isInteger(n) ? usd0.format(n) : usd2.format(n)
}

export function percent(fraction: number): string {
  if (typeof fraction !== "number" || !Number.isFinite(fraction)) return "—"
  return `${Math.round(fraction * 100)}%`
}

export function formatDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
