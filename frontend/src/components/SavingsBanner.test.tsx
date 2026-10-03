import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SavingsBanner } from './SavingsBanner'

describe('SavingsBanner', () => {
  it('shows the S2 numbers from props', () => {
    render(<SavingsBanner baseline={2300} optimized={1405} savings={895} />)
    expect(screen.getByTestId('savings-amount')).toHaveTextContent('$895')
    expect(screen.getAllByText('$2,300').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$1,405').length).toBeGreaterThan(0)
  })
})
