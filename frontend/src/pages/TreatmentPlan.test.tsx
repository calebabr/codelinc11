import { describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TreatmentPlan } from './TreatmentPlan'
import { usePlan } from '@/state/PlanContext'
import { renderWithProviders, routeFetch } from '@/test/helpers'
import { CROWN } from '@/test/fixtures'
import type { ParsedTreatment, TreatmentPlanParseResponse } from '@/lib/types'

function item(p: Partial<ParsedTreatment>): ParsedTreatment {
  return {
    id: 'q1', code: 'D3330', name: 'Root canal, molar', tooth: '19', quoted_fee: 1100, typical_fee: 1100,
    urgency: 'urgent', after: null, phase: 'Phase 1', matched: true, confidence: 1, source_line: '', ...p,
  }
}

const PARSED: TreatmentPlanParseResponse = {
  items: [
    item({}),
    item({ id: 'q2', code: 'D2740', name: 'Crown, porcelain/ceramic', quoted_fee: 1500, typical_fee: 1200, urgency: 'soon', after: 'q1', phase: 'Phase 2' }),
    item({ id: 'q3', code: 'D2392', name: 'Filling, 2 surfaces (composite)', tooth: '14', quoted_fee: 200, typical_fee: 200, urgency: 'soon', phase: 'Phase 2' }),
    item({ id: 'q4', code: 'D2392', name: 'Filling, 2 surfaces (composite)', tooth: '15', quoted_fee: null, typical_fee: 200, urgency: 'soon', phase: 'Phase 2' }),
  ],
  unmatched_lines: ['Tooth 8 Zirconia veneer $950'],
  notes: ['We matched 4 of 5 lines.'],
  mode: 'rules',
}

function Probe() {
  const { draft } = usePlan()
  return <pre data-testid="draft">{JSON.stringify(draft)}</pre>
}

function setup(parsed: TreatmentPlanParseResponse | (() => Response) = PARSED) {
  window.localStorage.clear()
  const f = vi.fn(
    routeFetch({
      '/procedures': [{ procedure: CROWN, score: 1 }],
      '/treatment-plan/parse': parsed,
    }),
  )
  vi.stubGlobal('fetch', f)
  const onNavigate = vi.fn()
  renderWithProviders(
    <>
      <TreatmentPlan onNavigate={onNavigate} />
      <Probe />
    </>,
  )
  return { f, onNavigate }
}

async function readSample() {
  await userEvent.click(screen.getByRole('button', { name: /Use a sample treatment plan/i }))
  await userEvent.click(screen.getByRole('button', { name: /Read my plan/i }))
  await screen.findAllByTestId('quote-item')
}

describe('Treatment plan page', () => {
  it('renders the form and privacy note, with Read disabled until there is text', () => {
    setup()
    expect(screen.getByRole('heading', { name: /Your dentist's quote/i })).toBeInTheDocument()
    expect(screen.getByText(/stays in this browser tab and isn't saved/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Read my plan/i })).toBeDisabled()
  })

  it('sample + read shows cards, notes, unmatched panel and the mode badge', async () => {
    const { f } = setup()
    await readSample()
    expect(screen.getByLabelText(/Treatment plan text/i)).toHaveDisplayValue(/D3330/)
    expect(screen.getAllByTestId('quote-item')).toHaveLength(4)
    expect(screen.getByText('Read with rules')).toBeInTheDocument()
    expect(screen.getByText('We matched 4 of 5 lines.')).toBeInTheDocument()
    expect(screen.getByText(/We couldn't read these lines/i)).toBeInTheDocument()
    expect(screen.getByText('Tooth 8 Zirconia veneer $950')).toBeInTheDocument()
    expect(screen.getAllByText('Tooth 19').length).toBe(2)
    // category chip from the catalog (crown is major), above-typical badge only on the crown (1500 vs 1200)
    expect(await screen.findByText('Major')).toBeInTheDocument()
    expect(screen.getAllByText('Above typical')).toHaveLength(1)
    const call = f.mock.calls.find(([u]) => String(u).includes('/treatment-plan/parse'))!
    const body = JSON.parse((call as unknown as [string, RequestInit])[1].body as string)
    expect(body.plan_id).toBe('demo_ppo')
    expect(body.text).toContain('Root canal')
  })

  it('Optimize hands matched items to the draft and navigates to plan-year', async () => {
    const { onNavigate } = setup()
    await readSample()
    await userEvent.click(screen.getByRole('button', { name: /Optimize my year with these/i }))
    expect(onNavigate).toHaveBeenCalledWith('plan-year')
    const draft = JSON.parse(screen.getByTestId('draft').textContent!)
    expect(draft.items).toEqual([
      { id: 'q1', code: 'D3330', urgency: 'urgent', after: null },
      { id: 'q2', code: 'D2740', urgency: 'soon', after: 'q1' },
      { id: 'q3', code: 'D2392', urgency: 'soon', after: null },
      { id: 'q4', code: 'D2392', urgency: 'soon', after: null },
    ])
    expect(draft.quotedFees).toEqual({ q1: 1100, q2: 1500, q3: 200 })
  })

  it('editing urgency and removing an item changes what is handed off', async () => {
    const { onNavigate } = setup()
    await readSample()
    const group = screen.getByRole('radiogroup', { name: /Urgency for Filling, 2 surfaces \(composite\) tooth 14/i })
    await userEvent.click(within(group).getByRole('radio', { name: 'Flexible' }))
    await userEvent.click(screen.getByRole('button', { name: /Remove Root canal, molar tooth 19/i }))
    await userEvent.click(screen.getByRole('button', { name: /Optimize my year/i }))
    expect(onNavigate).toHaveBeenCalledWith('plan-year')
    const draft = JSON.parse(screen.getByTestId('draft').textContent!)
    expect(draft.items.map((i: { id: string }) => i.id)).toEqual(['q2', 'q3', 'q4'])
    expect(draft.items[0].after).toBeNull() // root canal removed, so the dependency is dropped
    expect(draft.items[1].urgency).toBe('flexible')
    expect(draft.quotedFees).toEqual({ q2: 1500, q3: 200 })
  })

  it('disables Optimize when nothing matched', async () => {
    setup({ items: [], unmatched_lines: ['???'], notes: ["We couldn't find any treatments."], mode: 'ollama' })
    await userEvent.type(screen.getByLabelText(/Treatment plan text/i), 'hello')
    await userEvent.click(screen.getByRole('button', { name: /Read my plan/i }))
    expect(await screen.findByText('Read with AI')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Optimize my year/i })).toBeDisabled()
  })

  it('shows the server message for an empty/invalid quote', async () => {
    setup(() => new Response(JSON.stringify({ detail: 'Paste your dentist\'s treatment plan text first.' }), {
      status: 422, headers: { 'Content-Type': 'application/json' },
    }))
    await userEvent.type(screen.getByLabelText(/Treatment plan text/i), 'x')
    await userEvent.click(screen.getByRole('button', { name: /Read my plan/i }))
    expect(await screen.findByText(/Paste your dentist's treatment plan text first/i)).toBeInTheDocument()
  })

  it('shows a friendly error when the backend is down and can retry', async () => {
    window.localStorage.clear()
    vi.stubGlobal('fetch', vi.fn((u: RequestInfo | URL) =>
      String(u).includes('/treatment-plan') ? Promise.reject(new TypeError('failed')) : routeFetch({ '/procedures': [] })(u),
    ))
    renderWithProviders(<TreatmentPlan onNavigate={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /Use a sample/i }))
    await userEvent.click(screen.getByRole('button', { name: /Read my plan/i }))
    expect(await screen.findByText(/Can't reach the server/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: /Try again/i })).toBeInTheDocument())
  })
})
