import type { AppNotification } from "@/lib/types/notifications"

/** Plain-word names for the kinds a person can choose to receive. */
export const KIND_CHOICES: { kind: string; label: string }[] = [
  { kind: "upcoming_appointment", label: "Appointments" },
  { kind: "reminder", label: "Reminders" },
  { kind: "benefits_expiring", label: "Benefits ending soon" },
  { kind: "preventive_unused", label: "Unused checkups" },
  { kind: "deductible_met", label: "Deductible met" },
  { kind: "procedure_planned", label: "Planned treatment" },
  { kind: "claim_update", label: "Claim updates" },
  { kind: "eob_ready", label: "Statements ready" },
]

export type FilterId = "all" | "unread" | "appointments" | "benefits" | "claims"

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "appointments", label: "Appointments and reminders" },
  { id: "benefits", label: "Benefits" },
  { id: "claims", label: "Claims" },
]

const GROUPS: Record<Exclude<FilterId, "all" | "unread">, string[]> = {
  appointments: ["upcoming_appointment", "reminder", "procedure_planned"],
  benefits: ["benefits_expiring", "preventive_unused", "deductible_met"],
  claims: ["claim_update", "eob_ready"],
}

export function matchesFilter(n: AppNotification, f: FilterId): boolean {
  if (f === "all") return true
  if (f === "unread") return n.read_at === null
  return GROUPS[f].includes(n.kind)
}

export function severityClass(s: string): string {
  if (s === "warning") return "border-l-4 border-orange-dark bg-tint-orange"
  if (s === "success") return "border-l-4 border-ok bg-tint-ok"
  return "border-l-4 border-line bg-white"
}

/** "Nov 18": format only, from the API date. */
export function shortDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""))
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}
