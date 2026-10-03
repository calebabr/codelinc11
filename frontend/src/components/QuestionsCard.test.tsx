import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { QuestionsCard } from './QuestionsCard'
import { jsonResponse, renderWithProviders, routeFetch } from '@/test/helpers'

const RESPONSE = {
  safety_note: "If you have pain, swelling, or an infection, don't wait on this list.",
  sections: [
    {
      id: 'urgency',
      title: 'Is it urgent?',
      questions: [
        { id: 'u1', text: 'Is this urgent?', why: 'Because timing matters.' },
        { id: 'u2', text: 'What if I wait?', why: 'Resets help.' },
      ],
    },
    {
      id: 'billing',
      title: 'Cost and billing',
      questions: [{ id: 'b1', text: 'Are you in network?', why: 'Balance billing.' }],
    },
  ],
}

describe('QuestionsCard', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
  })

  it('renders sections, safety note and helper text', async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/questions': RESPONSE })))
    renderWithProviders(<QuestionsCard codes={['D2740']} />)
    expect(await screen.findByText('Questions to ask your dentist')).toBeInTheDocument()
    expect(await screen.findByText('Is it urgent?')).toBeInTheDocument()
    expect(screen.getByText(/don't wait on this list/)).toBeInTheDocument()
    expect(screen.getByText('Because timing matters.')).toBeInTheDocument()
    expect(screen.getByTestId('questions-progress')).toHaveTextContent('0 of 3 asked')
  })

  it('toggling a question updates progress', async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/questions': RESPONSE })))
    renderWithProviders(<QuestionsCard codes={['D2740']} />)
    const box = await screen.findByRole('checkbox', { name: /Is this urgent\?/ })
    expect(box).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(box)
    expect(box).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByTestId('questions-progress')).toHaveTextContent('1 of 3 asked')
    expect(screen.getByText('1/2')).toBeInTheDocument()
  })

  it('copies a plain-text checklist', async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/questions': RESPONSE })))
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderWithProviders(<QuestionsCard codes={['D2740']} />)
    fireEvent.click(await screen.findByRole('checkbox', { name: /What if I wait\?/ }))
    fireEvent.click(screen.getByRole('button', { name: /Copy list/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const text = writeText.mock.calls[0][0] as string
    expect(text).toContain('Is it urgent?\n[ ] Is this urgent?\n[x] What if I wait?')
    expect(text).toContain('Cost and billing\n[ ] Are you in network?')
    expect(await screen.findByText('Copied to your clipboard.')).toBeInTheDocument()
  })

  it('still fetches with empty codes', async () => {
    const route = routeFetch({ '/questions': RESPONSE })
    const f = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => route(input))
    vi.stubGlobal('fetch', f)
    renderWithProviders(<QuestionsCard codes={[]} />)
    expect(await screen.findByText('Cost and billing')).toBeInTheDocument()
    const body = JSON.parse(String(f.mock.calls[0][1]?.body))
    expect(body.codes).toEqual([])
  })

  it('section header collapses', async () => {
    vi.stubGlobal('fetch', vi.fn(routeFetch({ '/questions': RESPONSE })))
    renderWithProviders(<QuestionsCard codes={[]} />)
    const head = await screen.findByRole('button', { name: /Cost and billing/ })
    expect(head).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(head)
    expect(head).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Are you in network?')).not.toBeInTheDocument()
  })

  it('shows a compact retry on error', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ detail: 'boom' }, 500))))
    renderWithProviders(<QuestionsCard codes={['D2740']} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
