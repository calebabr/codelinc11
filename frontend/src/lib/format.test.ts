import { describe, expect, it } from 'vitest'
import { MONTH_OPTIONS, money, monthName, monthShort, pct, plural } from './format'

describe('format', () => {
  it('formats whole dollars without cents', () => {
    expect(money(800)).toBe('$800')
    expect(money(1405)).toBe('$1,405')
    expect(money(0)).toBe('$0')
  })
  it('shows cents when needed', () => {
    expect(money(12.5)).toBe('$12.50')
  })
  it('handles non-finite input', () => {
    expect(money(NaN)).toBe('$0')
  })
  it('formats percentages', () => {
    expect(pct(0.8)).toBe('80%')
    expect(pct(1)).toBe('100%')
    expect(pct(0.5)).toBe('50%')
  })
  it('names months', () => {
    expect(monthName(1)).toBe('January')
    expect(monthName(11)).toBe('November')
    expect(monthShort(12)).toBe('Dec')
    expect(MONTH_OPTIONS).toHaveLength(12)
    expect(MONTH_OPTIONS[0]).toEqual({ value: 1, label: 'January' })
  })
  it('pluralizes', () => {
    expect(plural(1, 'cleaning')).toBe('cleaning')
    expect(plural(2, 'cleaning')).toBe('cleanings')
  })
})
