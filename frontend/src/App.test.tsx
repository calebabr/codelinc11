import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/App'
import { SessionProvider } from '@/state/SessionContext'

function renderAt(path: string) {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  )
}

describe('portal routes', () => {
  const cases: [string, string | RegExp, string][] = [
    ['/', /^Welcome back/, 'Home'],
    ['/plans', 'Plans', 'Plans'],
    ['/family', 'Family', 'Family'],
    ['/costs', 'Costs', 'Costs'],
    ['/plan-year', 'Plan My Year', 'Plan My Year'],
    ['/assistant', 'Assistant', 'Assistant'],
  ]
  it.each(cases)('renders %s with heading %s and highlights its nav item', (path, heading, navLabel) => {
    renderAt(path)
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { current: 'page' })).toHaveTextContent(navLabel)
  })

  it('shows the assistant button everywhere except /assistant', () => {
    const { unmount } = renderAt('/plans')
    expect(screen.getByRole('button', { name: 'Open assistant' })).toBeInTheDocument()
    unmount()
    renderAt('/assistant')
    expect(screen.queryByRole('button', { name: 'Open assistant' })).not.toBeInTheDocument()
  })

  it('opens and closes the assistant panel', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Open assistant' }))
    expect(screen.getByRole('dialog', { name: 'Assistant' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close assistant' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('member switching', () => {
  it('updates the header label when another member is chosen', async () => {
    const user = userEvent.setup()
    renderAt('/family')
    expect(screen.getByTestId('active-member-label')).toHaveTextContent('Jordan Rivera')

    await user.click(screen.getByRole('button', { name: /viewing/i }))
    await user.click(
      within(screen.getByRole('group', { name: 'Choose a family member' })).getByRole('button', { name: /Alex Rivera/ }),
    )

    expect(screen.getByTestId('active-member-label')).toHaveTextContent('Alex Rivera')
    expect(screen.queryByRole('group', { name: 'Choose a family member' })).not.toBeInTheDocument()
  })

  it('marks the active member with aria-pressed and uses no native select', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/')
    await user.click(screen.getByRole('button', { name: /viewing/i }))
    const menu = within(screen.getByRole('group', { name: 'Choose a family member' }))
    expect(menu.getByRole('button', { name: /Jordan Rivera/ })).toHaveAttribute('aria-pressed', 'true')
    expect(menu.getByRole('button', { name: /Maya Rivera/ })).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('select')).toBeNull()
  })
})
