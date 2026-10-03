import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChatDrawer } from './ChatDrawer'
import { renderWithProviders, routeFetch, sseResponse } from '@/test/helpers'

function setup(chatMode: 'ollama' | 'fallback' = 'fallback') {
  const f = vi.fn(
    routeFetch({
      '/health': { ok: true, ollama_available: chatMode === 'ollama', ollama_model: 'llama3.2:3b', chat_mode: chatMode },
      '/chat': () =>
        sseResponse([
          ['tool_start', { name: 'estimate_cost', args: { code: 'D2740' } }],
          ['tool_end', { name: 'estimate_cost', result: { you_pay: 625 } }],
          ['token', { text: 'A crown would cost you ' }],
          ['token', { text: '$625.' }],
          ['done', { mode: chatMode }],
        ]),
    }),
  )
  vi.stubGlobal('fetch', f)
  window.localStorage.clear()
  renderWithProviders(<ChatDrawer />)
  return f
}

describe('ChatDrawer', () => {
  it('shows the offline badge from /health', async () => {
    setup('fallback')
    await userEvent.click(screen.getByRole('button', { name: /Open chat assistant/i }))
    expect(await screen.findByText('AI: offline mode')).toBeInTheDocument()
  })

  it('shows the Ollama badge', async () => {
    setup('ollama')
    await userEvent.click(screen.getByRole('button', { name: /Open chat assistant/i }))
    expect(await screen.findByText('AI: Ollama')).toBeInTheDocument()
  })

  it('streams tokens, shows tool chip, and sends the request context', async () => {
    const f = setup('fallback')
    await userEvent.click(screen.getByRole('button', { name: /Open chat assistant/i }))
    expect(screen.getByText('What if I wait until January?')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Your question'), 'What will a crown cost me?')
    await userEvent.click(screen.getByRole('button', { name: /Send message/i }))

    expect(await screen.findByText(/A crown would cost you \$625\./)).toBeInTheDocument()
    expect(screen.getByText(/Calculated/)).toBeInTheDocument()
    expect(screen.getByTestId('chat-mode')).toHaveTextContent('AI: offline mode')

    const call = f.mock.calls.find(([u]) => String(u).endsWith('/chat'))!
    const body = JSON.parse((call as unknown as [string, RequestInit])[1].body as string)
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'What will a crown cost me?' })
    expect(body.plan_id).toBe('demo_ppo')
    expect(body.current_month).toBe(11)
  })

  it('suggested prompt sends immediately', async () => {
    setup('fallback')
    await userEvent.click(screen.getByRole('button', { name: /Open chat assistant/i }))
    await userEvent.click(screen.getByText('What will a crown cost me?'))
    expect(await screen.findByText(/\$625\./)).toBeInTheDocument()
  })
})
