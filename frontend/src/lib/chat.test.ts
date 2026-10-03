import { describe, expect, it, vi } from 'vitest'
import { streamChat } from './chat'
import { jsonResponse, sseResponse } from '@/test/helpers'

const req = {
  messages: [{ role: 'user' as const, content: 'What will a crown cost me?' }],
  plan_id: 'demo_ppo',
  usage: { max_used: 0, deductible_met: 0, history: [] },
  current_month: 11,
}

describe('streamChat', () => {
  it('dispatches events in order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        sseResponse([
          ['tool_start', { name: 'estimate_cost', args: { code: 'D2740' } }],
          ['tool_end', { name: 'estimate_cost', result: { you_pay: 625 } }],
          ['token', { text: 'You pay ' }],
          ['token', { text: '$625.' }],
          ['done', { mode: 'fallback' }],
        ]),
      ),
    )
    const log: string[] = []
    await streamChat(req, {
      onToolStart: (n) => log.push(`start:${n}`),
      onToolEnd: (n) => log.push(`end:${n}`),
      onToken: (t) => log.push(`token:${t}`),
      onDone: (m) => log.push(`done:${m}`),
      onError: (m) => log.push(`error:${m}`),
    })
    expect(log).toEqual([
      'start:estimate_cost',
      'end:estimate_cost',
      'token:You pay ',
      'token:$625.',
      'done:fallback',
    ])
  })

  it('reports an error for non-OK responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'x' }, 500)))
    const onError = vi.fn()
    await streamChat(req, { onError })
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('reports an error when the server is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))
    const onError = vi.fn()
    await streamChat(req, { onError })
    expect(onError.mock.calls[0][0]).toMatch(/Can't reach the server/)
  })
})
