import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Estimate } from './Estimate'
import { renderWithProviders, routeFetch } from '@/test/helpers'
import { CROWN, G3_RESPONSE } from '@/test/fixtures'

describe('Estimate page', () => {
  it('shows "$800" from a mocked G3 response', async () => {
    window.localStorage.clear()
    const f = vi.fn(
      routeFetch({
        '/procedures': [{ procedure: CROWN, score: 1 }],
        '/estimate': G3_RESPONSE,
      }),
    )
    vi.stubGlobal('fetch', f)
    renderWithProviders(<Estimate />)

    await userEvent.type(screen.getByRole('combobox'), 'crown')
    const option = await screen.findByRole('option', { name: /Crown/i })
    await userEvent.click(option)

    await waitFor(() => expect(screen.getByTestId('you-pay')).toHaveTextContent('$800'))
    expect(screen.getAllByText(/This is an estimate, not a guarantee/i).length).toBeGreaterThan(0)
    // balance billing from the out-of-network side is displayed from API data
    expect(screen.getAllByText(/\$300/).length).toBeGreaterThan(0)
    const estimateCall = f.mock.calls.find(([u]) => String(u).includes('/estimate'))!
    expect(JSON.parse((estimateCall as unknown as [string, RequestInit])[1].body as string).code).toBe('D2740')
  })

  it('shows a friendly error when the backend is down', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    renderWithProviders(<Estimate />)
    await userEvent.type(screen.getByRole('combobox'), 'crown')
    expect(await screen.findByText(/Can't reach the server/i)).toBeInTheDocument()
  })
})
