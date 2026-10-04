import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import JoinPage from './JoinPage'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <JoinPage />
    </MemoryRouter>,
  )
}

describe('JoinPage', () => {
  it('renders a QR svg and the app address', async () => {
    renderAt('/join')
    const expected = `${window.location.origin}/welcome`
    expect(screen.getByTestId('join-address')).toHaveTextContent(expected)
    await waitFor(() => expect(screen.getByTestId('qr').querySelector('svg')).not.toBeNull())
    expect(screen.getByText(/scan with your phone/i)).toBeInTheDocument()
  })

  it('uses a valid ?url= override', async () => {
    renderAt('/join?url=' + encodeURIComponent('https://demo.trycloudflare.com/welcome'))
    expect(screen.getByTestId('join-address')).toHaveTextContent('https://demo.trycloudflare.com/welcome')
    await waitFor(() => expect(screen.getByTestId('qr').querySelector('svg')).not.toBeNull())
  })

  it('ignores an invalid ?url= value', () => {
    renderAt('/join?url=' + encodeURIComponent('javascript:alert(1)'))
    expect(screen.getByTestId('join-address')).toHaveTextContent(`${window.location.origin}/welcome`)
  })

  it('copies the link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderAt('/join')
    await userEvent.click(screen.getByRole('button', { name: /copy link/i }))
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/welcome`)
    expect(await screen.findByText('Link copied.')).toBeInTheDocument()
  })
})
