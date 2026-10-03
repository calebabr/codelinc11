import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Setup } from './Setup'
import { renderWithProviders, routeFetch } from '@/test/helpers'
import { BASIC_PLAN, DEMO_PLAN } from '@/test/fixtures'

describe('Setup page', () => {
  it('lists sample plans and shows the plain-English summary', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/plans': [DEMO_PLAN, BASIC_PLAN] })))
    renderWithProviders(<Setup onNavigate={() => {}} />)

    expect(await screen.findByRole('button', { name: /Demo PPO/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Basic PPO/ })).toBeInTheDocument()
    const summary = await screen.findByTestId('plan-summary')
    expect(summary).toHaveTextContent('Your plan pays 100% of cleanings')
    expect(summary).toHaveTextContent('80% of fillings')
    expect(summary).toHaveTextContent('50% of crowns')
  })

  it('switching plan updates the summary', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/plans': [DEMO_PLAN, BASIC_PLAN] })))
    renderWithProviders(<Setup onNavigate={() => {}} />)
    await userEvent.click(await screen.findByRole('button', { name: /Basic PPO/ }))
    expect(await screen.findByTestId('plan-summary')).toHaveTextContent('70% of fillings')
  })

  it('shows an error state when plans cannot load', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    renderWithProviders(<Setup onNavigate={() => {}} />)
    expect(await screen.findByText(/Can't reach the server/i)).toBeInTheDocument()
  })
})
