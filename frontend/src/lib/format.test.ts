import { describe, expect, it } from "vitest"
import { money, percent } from "./format"

describe("money", () => {
  it("formats whole and fractional dollars", () => {
    expect(money(0)).toBe("$0")
    expect(money(1100)).toBe("$1,100")
    expect(money(12.5)).toBe("$12.50")
  })
  it("never outputs NaN for bad values", () => {
    for (const bad of [NaN, Infinity, -Infinity, undefined as unknown as number, null as unknown as number, true as unknown as number]) {
      expect(money(bad)).toBe("—")
    }
    expect(percent(NaN)).toBe("—")
  })
})
