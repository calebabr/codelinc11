import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { isAboveTypical, PriceBars } from './PriceBars'
import { buildHandoff } from './buildHandoff'

describe('isAboveTypical', () => {
  it('flags only quotes more than 15% above typical', () => {
    expect(isAboveTypical(1500, 1200)).toBe(true)
    expect(isAboveTypical(1380, 1200)).toBe(false)
    expect(isAboveTypical(null, 1200)).toBe(false)
    expect(isAboveTypical(1500, null)).toBe(false)
  })
})

describe('PriceBars', () => {
  it('shows both values from the API', () => {
    render(<PriceBars quoted={1500} typical={1200} />)
    expect(screen.getByText('$1,500')).toBeInTheDocument()
    expect(screen.getByText('$1,200')).toBeInTheDocument()
  })
  it('shows n/a when the quote has no fee', () => {
    render(<PriceBars quoted={null} typical={200} />)
    expect(screen.getByText('n/a')).toBeInTheDocument()
  })
})

describe('buildHandoff', () => {
  it('skips unmatched items', () => {
    const d = buildHandoff([
      { id: 'q1', code: null, name: 'x', tooth: null, quoted_fee: 5, typical_fee: null, urgency: 'soon', after: null, phase: null, matched: false, confidence: 0, source_line: '' },
    ])
    expect(d).toEqual({ items: [], quotedFees: {} })
  })
})
