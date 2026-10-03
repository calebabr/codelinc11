import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlanYear } from './PlanYear'
import { renderWithProviders, routeFetch } from '@/test/helpers'
import { CROWN, S2_RESPONSE } from '@/test/fixtures'

describe('Plan My Year page', () => {
  it('Load demo case shows the S2 savings banner ($895)', async () => {
    window.localStorage.clear()
    const f = vi.fn(
      routeFetch({
        '/procedures': [{ procedure: CROWN, score: 1 }],
        '/schedule': S2_RESPONSE,
      }),
    )
    vi.stubGlobal('fetch', f)
    renderWithProviders(<PlanYear />)

    await userEvent.click(screen.getByRole('button', { name: /Load demo case/i }))

    await waitFor(() => expect(screen.getByTestId('savings-amount')).toHaveTextContent('$895'))
    expect(screen.getAllByText('$2,300').length).toBeGreaterThan(0)
    expect(screen.getAllByText('$1,405').length).toBeGreaterThan(0)
    expect(screen.getByText(/stays this year because it is urgent/i)).toBeInTheDocument()
    expect(screen.getByRole('separator', { name: /New plan year/i })).toBeInTheDocument()

    const call = f.mock.calls.find(([u]) => String(u).includes('/schedule'))!
    const body = JSON.parse((call as unknown as [string, RequestInit])[1].body as string)
    expect(body.usage.max_used).toBe(1100)
    expect(body.usage.deductible_met).toBe(50)
    expect(body.current_month).toBe(11)
    expect(body.items).toHaveLength(4)
    expect(body.items[0]).toMatchObject({ code: 'D3330', urgency: 'urgent' })
    expect(body.items[1].after).toBe('t1')
  })

  it('toggle switches to the everything-now schedule', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/procedures': [], '/schedule': S2_RESPONSE })))
    renderWithProviders(<PlanYear />)
    await userEvent.click(screen.getByRole('button', { name: /Load demo case/i }))
    await screen.findByTestId('savings-amount')

    const everything = screen.getByRole('radio', { name: 'Everything now' })
    await userEvent.click(everything)
    expect(everything).toBeChecked()
    expect(screen.queryByRole('separator', { name: /New plan year/i })).not.toBeInTheDocument()
  })

  it('shows an error when scheduling fails', async () => {
    window.localStorage.clear()
    vi.stubGlobal(
      'fetch',
      vi.fn((u: RequestInfo | URL) =>
        String(u).includes('/schedule')
          ? Promise.reject(new TypeError('failed'))
          : routeFetch({ '/procedures': [] })(u),
      ),
    )
    renderWithProviders(<PlanYear />)
    await userEvent.click(screen.getByRole('button', { name: /Load demo case/i }))
    expect(await screen.findByText(/Can't reach the server/i)).toBeInTheDocument()
  })
})
