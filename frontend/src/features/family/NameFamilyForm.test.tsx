import { describe, expect, it } from "vitest"
import type { FamilyMember } from "@/lib/types/family"
import { nameProblem, slotsFor, surnameOf } from "./NameFamilyForm"

const m = (id: string, over: Partial<FamilyMember>): FamilyMember => ({
  id, household_id: "hh-z", name: id, relationship: "child", age: 10, role: "managed", has_login: false, status: "active", status_note: null, ...over,
})

describe("slotsFor", () => {
  it("matches people by role, relationship and age, not by id or name (order and ids are arbitrary)", () => {
    const members = [
      m("zz-1", { role: "adult", relationship: "child", age: 23, has_login: true }),
      m("zz-2", { role: "managed", relationship: "child", age: 8 }),
      m("zz-3", { role: "adult", relationship: "domestic partner", age: 40, has_login: true }),
      m("zz-4", { role: "primary", relationship: "self", age: 42, has_login: true }),
    ]
    const byKey = Object.fromEntries(slotsFor(members).map((s) => [s.key, s.member.id]))
    expect(byKey).toEqual({ you: "zz-4", spouse: "zz-3", young: "zz-2", older: "zz-1" })
  })

  it("leaves out a person the household does not have", () => {
    const members = [m("a", { role: "primary", relationship: "self" }), m("b", { role: "managed" })]
    expect(slotsFor(members).map((s) => s.key)).toEqual(["you", "young"])
  })
})

describe("name rules (the same as the server's)", () => {
  it("accepts letters with accents, spaces, apostrophes, hyphens and periods", () => {
    for (const ok of ["Sam", "José Núñez", "Mia O'Brien-Smith", "Dr. Lee", "Zoë"]) expect(nameProblem(ok, 24, true)).toBe("")
  })
  it("refuses digits, symbols, markup, empty and too long", () => {
    expect(nameProblem("Sam 3", 24, true)).toMatch(/letters/)
    expect(nameProblem("<b>Sam</b>", 24, true)).toMatch(/letters/)
    expect(nameProblem("   ", 24, true)).toBe("Please enter a name.")
    expect(nameProblem("   ", 30, false)).toBe("")
    expect(nameProblem("A".repeat(25), 24, true)).toBe("Use 24 characters or fewer.")
    expect(nameProblem("A".repeat(30), 30, false)).toBe("")
  })
  it("takes the surname from the household name", () => {
    expect(surnameOf("Rivera household")).toBe("Rivera")
    expect(surnameOf("Lee")).toBe("Lee")
  })
})
