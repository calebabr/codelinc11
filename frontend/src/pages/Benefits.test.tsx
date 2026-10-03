import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { Benefits } from './Benefits'
import { renderWithProviders, routeFetch } from '@/test/helpers'

const STATUS = {
  plan_name: 'Demo PPO',
  annual_max: 1500,
  max_used: 1100,
  max_remaining: 400,
  deductible: 50,
  deductible_met: 50,
  deductible_remaining: 0,
  frequencies: [{ code: 'D1110', name: 'Cleaning (adult)', used: 1, limit: 2, remaining: 1 }],
  unused_preventive_value: 180,
  months_left: 2,
  reminder: 'Your benefits reset soon: use them before December 31.',
}

describe('Benefits page', () => {
  it('shows remaining max, reminder and calendar link from the API', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/procedures': [], '/benefits-status': STATUS })))
    renderWithProviders(<Benefits />)

    expect(await screen.findByTestId('max-remaining')).toHaveTextContent('$400')
    expect(screen.getByRole('alert')).toHaveTextContent(/benefits reset soon/i)
    const link = screen.getByRole('link', { name: /Add to calendar/i })
    expect(link.getAttribute('href')).toContain('/reminders.ics')
    expect(link.getAttribute('href')).toContain('max_remaining=400')
    expect(screen.getByText(/Cleaning/)).toBeInTheDocument()
  })

  it('hides the reminder banner when null', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/procedures': [], '/benefits-status': { ...STATUS, reminder: null } })))
    renderWithProviders(<Benefits />)
    await screen.findByTestId('max-remaining')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows an error state when the backend is down', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    renderWithProviders(<Benefits />)
    expect(await screen.findByText(/Can't reach the server/i)).toBeInTheDocument()
  })
})
