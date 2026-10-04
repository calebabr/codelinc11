import type { FamilyMember, ProfilePatch } from "@/lib/types/family"

export const NOTES_MAX = 200

/** Digits only: what the server stores. */
export const digitsOnly = (v: string) => v.replace(/\D/g, "")

/** 3345550143 -> (334) 555-0143. Anything else is shown as it was saved. */
export function formatPhone(digits: string | null | undefined): string {
  const d = digitsOnly(digits ?? "")
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return digits ?? ""
}

export interface ProfileValues {
  name: string
  dob: string
  email: string
  phone: string
  zip: string
  notes: string
}

export function valuesOf(m: FamilyMember): ProfileValues {
  return {
    name: m.name,
    dob: m.dob ?? "",
    email: m.email ?? "",
    phone: m.phone ?? "",
    zip: m.zip ?? "",
    notes: m.notes ?? "",
  }
}

/** Only the fields that changed. Cleared optional fields are sent as null. */
export function changedFields(m: FamilyMember, v: ProfileValues): ProfilePatch {
  const before = valuesOf(m)
  const patch: ProfilePatch = {}
  const name = v.name.trim()
  if (name !== before.name) patch.name = name
  if (v.dob !== before.dob) patch.dob = v.dob
  const optional: Array<["email" | "phone" | "zip" | "notes", string]> = [
    ["email", v.email.trim()],
    ["phone", digitsOnly(v.phone)],
    ["zip", v.zip.trim()],
    ["notes", v.notes.trim()],
  ]
  for (const [k, now] of optional) {
    if (now !== before[k]) patch[k] = now === "" ? null : now
  }
  return patch
}

export const inputCls = "min-h-11 w-full rounded-xl border border-[var(--line)] px-3 text-base"
export const DEMO_CONTACT_HELP = "Use made-up contact details. Nothing is sent in this demo."
