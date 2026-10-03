import { describe, expect, it, vi } from 'vitest'
import { ApiError, getPlans, postEstimate, remindersUrl, searchProcedures } from './api'
import { jsonResponse } from '@/test/helpers'

describe('api', () => {
  it('searchProcedures encodes the query', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse([]))
    vi.stubGlobal('fetch', f)
    await searchProcedures('root canal')
    expect(String(f.mock.calls[0][0])).toContain('/procedures?q=root%20canal')
  })

  it('postEstimate posts JSON', async () => {
    const f = vi.fn().mockResolvedValue(jsonResponse({ ok: 1 }))
    vi.stubGlobal('fetch', f)
    await postEstimate({ plan_id: 'demo_ppo', code: 'D2740', usage: { max_used: 0, deductible_met: 0, history: [] } })
    const [url, init] = f.mock.calls[0]
    expect(String(url)).toMatch(/\/estimate$/)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).code).toBe('D2740')
  })

  it('network failure gives a friendly ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    const err = await getPlans().catch((e) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.message).toMatch(/Can't reach the server/)
  })

  it('http error surfaces detail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Unknown plan' }, 404)))
    const err = await getPlans().catch((e) => e)
    expect(err.message).toBe('Unknown plan')
    expect(err.status).toBe(404)
  })

  it('remindersUrl builds the query', () => {
    const u = remindersUrl('Demo PPO', 400, 11)
    expect(u).toContain('/reminders.ics?')
    expect(u).toContain('max_remaining=400')
    expect(u).toContain('month=11')
    expect(u).toContain('plan_name=Demo+PPO')
  })
})
