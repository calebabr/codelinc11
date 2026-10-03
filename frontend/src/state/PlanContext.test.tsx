import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { PlanProvider, usePlan } from './PlanContext'

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      <PlanProvider>{children}</PlanProvider>
    </QueryClientProvider>
  )
}

describe('PlanContext', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('defaults to the demo plan, fresh usage, November', () => {
    const { result } = renderHook(() => usePlan(), { wrapper })
    expect(result.current.planRef).toEqual({ plan_id: 'demo_ppo' })
    expect(result.current.usage).toEqual({ max_used: 0, deductible_met: 0, history: [] })
    expect(result.current.currentMonth).toBe(11)
  })

  it('logVisit stores API-provided values (no frontend math beyond accumulation of history)', () => {
    const { result } = renderHook(() => usePlan(), { wrapper })
    act(() => result.current.logVisit('D1110', 120, 0))
    expect(result.current.usage.max_used).toBe(120)
    expect(result.current.usage.history).toEqual(['D1110'])
  })

  it('persists to localStorage and restores', () => {
    const first = renderHook(() => usePlan(), { wrapper })
    act(() => first.result.current.setUsage({ max_used: 1100, deductible_met: 50, history: ['D1110'] }))
    act(() => first.result.current.setCurrentMonth(10))
    first.unmount()
    const second = renderHook(() => usePlan(), { wrapper })
    expect(second.result.current.usage.max_used).toBe(1100)
    expect(second.result.current.currentMonth).toBe(10)
  })

  it('survives corrupted localStorage', () => {
    window.localStorage.setItem('dental-copilot-state-v1', '{not json')
    const { result } = renderHook(() => usePlan(), { wrapper })
    expect(result.current.planRef).toEqual({ plan_id: 'demo_ppo' })
  })

  it('custom plan overrides plan_id in planRef', () => {
    const { result } = renderHook(() => usePlan(), { wrapper })
    const plan = {
      id: 'custom', name: 'Mine', description: '', monthly_premium: 0, deductible: 50,
      deductible_waived_for: ['preventive' as const], annual_max: 1000,
      coinsurance: { preventive: 1, basic: 0.8, major: 0.5 }, frequency: {}, plan_year_start_month: 1,
    }
    act(() => result.current.setCustomPlan(plan))
    expect(result.current.planRef).toEqual({ plan })
    act(() => result.current.selectPlan('basic_ppo'))
    expect(result.current.planRef).toEqual({ plan_id: 'basic_ppo' })
  })
})
