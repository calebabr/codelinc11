import { describe, expect, it } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/App'
import { TestSessionProvider } from '@/test/session'

function renderAt(path: string) {
  return render(
    <TestSessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

describe('portal routes', () => {
  const cases: [string, string | RegExp, string][] = [
    ['/', /^Welcome back/, 'Home'],
    ['/plans', 'Plans', 'Plans'],
    ['/family', 'Family', 'Family'],
    ['/costs', 'Costs', 'Costs'],
    ['/plan-year', 'Plan My Year', 'Plan My Year'],
    ['/providers', 'Find a dentist near you', 'Providers'],
    ['/reports', 'Reports', 'Reports'],
    ['/assistant', 'Assistant', 'Assistant'],
  ]
  it.each(cases)('renders %s with heading %s and highlights its nav item', async (path, heading, navLabel) => {
    renderAt(path)
    // Pages load on demand (React.lazy), so wait for the heading.
    expect(await screen.findByRole('heading', { level: 1, name: heading }, { timeout: 14000 })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(within(nav).getByRole('link', { current: 'page' })).toHaveTextContent(navLabel)
  }, 20000)

  it('shows the assistant button everywhere except /assistant', async () => {
    const { unmount } = renderAt('/plans')
    await screen.findByRole('heading', { level: 1, name: 'Plans' }, { timeout: 14000 })
    expect(screen.getByRole('button', { name: 'Open assistant' })).toBeInTheDocument()
    unmount()
    renderAt('/assistant')
    await screen.findByRole('heading', { level: 1, name: 'Assistant' }, { timeout: 14000 })
    expect(screen.queryByRole('button', { name: 'Open assistant' })).not.toBeInTheDocument()
  }, 30000)

  it('opens and closes the assistant panel', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Open assistant' }))
    expect(screen.getByRole('dialog', { name: 'Assistant' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close assistant' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('assistant panel is a modal dialog: focus goes in, Escape closes, focus returns to the button', async () => {
    const user = userEvent.setup()
    renderAt('/')
    const opener = screen.getByRole('button', { name: 'Open assistant' })
    await user.click(opener)
    const dialog = screen.getByRole('dialog', { name: 'Assistant' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open assistant' })).toHaveFocus())
  })

  it('keeps Tab focus inside the open assistant panel', async () => {
    const user = userEvent.setup()
    renderAt('/')
    await user.click(screen.getByRole('button', { name: 'Open assistant' }))
    const dialog = screen.getByRole('dialog', { name: 'Assistant' })
    for (let i = 0; i < 12; i++) {
      await user.tab()
      expect(dialog).toContainElement(document.activeElement as HTMLElement)
    }
    await user.tab({ shift: true })
    expect(dialog).toContainElement(document.activeElement as HTMLElement)
  })
})

describe('member switching', () => {
  it('updates the header label when another member is chosen', async () => {
    const user = userEvent.setup()
    renderAt('/family')
    expect(screen.getByTestId('active-member-label')).toHaveTextContent('Jordan Rivera')

    await user.click(screen.getByRole('button', { name: /^viewing(?! as)/i }))
    await user.click(
      within(screen.getByRole('group', { name: 'Choose a family member' })).getByRole('button', { name: /Alex Rivera/ }),
    )

    expect(screen.getByTestId('active-member-label')).toHaveTextContent('Alex Rivera')
    expect(screen.queryByRole('group', { name: 'Choose a family member' })).not.toBeInTheDocument()
  })

  it('marks the active member with aria-pressed and uses no native select', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/')
    await user.click(screen.getByRole('button', { name: /^viewing(?! as)/i }))
    const menu = within(screen.getByRole('group', { name: 'Choose a family member' }))
    expect(menu.getByRole('button', { name: /Jordan Rivera/ })).toHaveAttribute('aria-pressed', 'true')
    expect(menu.getByRole('button', { name: /Maya Rivera/ })).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelector('select')).toBeNull()
  })
})
