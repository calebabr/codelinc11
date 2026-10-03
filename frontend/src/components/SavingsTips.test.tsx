import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SavingsTips } from './SavingsTips'
import { jsonResponse, renderWithProviders, routeFetch } from '@/test/helpers'
import type { SavingsTip, TreatmentItem } from '@/lib/types'

const ITEMS: TreatmentItem[] = [
  { id: 't1', code: 'D3330', urgency: 'urgent', after: null },
  { id: 't2', code: 'D2740', urgency: 'flexible', after: 't1' },
]

const TIMING: SavingsTip = {
  id: 'timing',
  kind: 'timing',
  title: 'Time your care around your plan year',
  summary: 'Moving care that can wait lowers your cost.',
  saving: 895,
  before: 2300,
  after: 1405,
  steps: [{ label: 'Doing everything now', amount: 2300, note: 'All this year costs you more.' }],
  assumptions: ['Only treatments your dentist says can safely wait are moved.'],
}
const FSA: SavingsTip = {
  id: 'fsa_hsa',
  kind: 'fsa_hsa',
  title: 'Pay with FSA or HSA money',
  summary: 'Pre-tax money.',
  saving: 156.25,
  before: 625,
  after: 468.75,
  steps: [],
  assumptions: ['Uses an assumed tax rate of 25%.'],
}
const RESPONSE = { tips: [TIMING, FSA], note: 'Tips overlap, so never add them up.' }

function setup(body: unknown = RESPONSE) {
  const f = vi.fn(routeFetch({ '/savings-tips': body }))
  vi.stubGlobal('fetch', f)
  window.localStorage.clear()
  renderWithProviders(<SavingsTips items={ITEMS} quotedFees={{ t2: 1600 }} />)
  return f
}
const bodies = (f: ReturnType<typeof vi.fn>) =>
  f.mock.calls
    .filter(([u]) => String(u).endsWith('/savings-tips'))
    .map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string))

describe('SavingsTips', () => {
  it('renders the card, note and tips from the response', async () => {
    const f = setup()
    expect(await screen.findByRole('heading', { name: 'Ways to save' })).toBeInTheDocument()
    expect(screen.getByText(/never add them up/)).toBeInTheDocument()
    expect(screen.getByText('Time your care around your plan year')).toBeInTheDocument()
    const b = bodies(f)[0]
    expect(b.items).toEqual(ITEMS)
    expect(b.quoted_fees).toEqual({ t2: 1600 })
    expect(b.plan_id).toBe('demo_ppo')
    expect(b.tax_rate).toBe(0.25)
  })

  it('shows before, after and saving straight from the API', async () => {
    setup()
    const card = await screen.findByTestId('tip-timing')
    expect(card).toHaveTextContent('$2,300')
    expect(card).toHaveTextContent('$1,405')
    expect(card.querySelector('[data-testid="tip-saving"]')).toHaveTextContent('$895')
  })

  it('expands to show steps and assumptions', async () => {
    setup()
    const btn = (await screen.findByText('Time your care around your plan year')).closest('button')!
    expect(btn).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Doing everything now')).not.toBeInTheDocument()
    await userEvent.click(btn)
    expect(btn).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Doing everything now')).toBeInTheDocument()
    expect(screen.getByText(/safely wait are moved/)).toBeInTheDocument()
  })

  it('tax-rate slider refetches with tax_rate', async () => {
    const f = setup()
    const thumb = await screen.findByRole('slider')
    thumb.focus()
    await userEvent.keyboard('{ArrowRight}{ArrowRight}')
    await waitFor(() => expect(bodies(f).some((b) => b.tax_rate === 0.27)).toBe(true), { timeout: 2000 })
  })

  it('renders nothing when there are no tips', async () => {
    const f = setup({ tips: [], note: 'n' })
    await waitFor(() => expect(bodies(f).length).toBe(1))
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Ways to save' })).not.toBeInTheDocument()
  })

  it('shows a compact retry on error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ detail: 'Unknown procedure code D9' }, 422))))
    window.localStorage.clear()
    renderWithProviders(<SavingsTips items={ITEMS} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
