// Smoke test (T13): the six portal routes render for a signed-in session with a mocked API
// and write nothing to console.error or console.warn.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/App'
import { TestSessionProvider } from '@/test/session'

const BENEFITS = {
  plan_name: 'Preferred',
  annual_max: 1500,
  max_used: 1100,
  max_remaining: 400,
  deductible: 50,
  deductible_met: 50,
  deductible_remaining: 0,
  frequencies: [{ code: 'D1110', name: 'Cleaning', used: 1, limit: 2, remaining: 1 }],
  unused_preventive_value: 0,
  months_left: 2,
  reminder: null,
}

function overview(id: string) {
  return {
    member: { id },
    plan_tier: { id: 'preferred', name: 'Preferred' },
    usage: { plan_year: 2026, max_used: 1100, deductible_met: 50, visits: 1, cleanings_used: 1 },
    benefits: BENEFITS,
    reminder: null,
    eligibility: [],
    as_of: '2026-11-01',
  }
}

function mockApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string) => {
      const url = String(input)
      const ok = (d: unknown) => ({ ok: true, status: 200, json: async () => d, text: async () => '' })
      const m = url.match(/\/members\/([^/?]+)\/(overview|schedule)/)
      if (m?.[2] === 'overview') return ok(overview(m[1]))
      if (m?.[2] === 'schedule') return ok([])
      if (url.includes('/assistant-context'))
        return ok({
          member_id: 'm-jordan', name: 'Marc Halog', plan: 'Preferred', plan_highlights: 'Cleanings 100%.',
          history: [], preferences: [], must_haves: [], chat_memory: [], attachments: [], shared_with_assistant: ['plan', 'usage'],
        })
      if (url.includes('/chat/suggestions')) return ok({ member_id: 'm-jordan', suggestions: [] })
      return ok([])
    }),
  )
}

describe('portal route smoke test', () => {
  let errors: unknown[][]
  beforeEach(() => {
    errors = []
    mockApi()
    vi.spyOn(console, 'error').mockImplementation((...a) => void errors.push(a))
    vi.spyOn(console, 'warn').mockImplementation((...a) => void errors.push(a))
  })
  afterEach(() => vi.restoreAllMocks())

  const routes: [string, string | RegExp][] = [
    ['/', /^Welcome back/],
    ['/plans', 'Plans'],
    ['/family', 'Family'],
    ['/costs', 'Costs'],
    ['/plan-year', 'Plan My Year'],
    ['/assistant', 'Assistant'],
  ]

  it.each(routes)('%s renders its heading with no console errors', async (path, heading) => {
    render(
      <TestSessionProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </TestSessionProvider>,
    )
    expect(await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 14000 })).toBeInTheDocument()
    // Let the mocked requests settle (inside act) before checking the console.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100))
    })
    expect(errors).toEqual([])
  }, 20000)
})
