import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { AppRoutes } from '@/App'
import { TestSessionProvider } from '@/test/session'

// Phone support (T39): the attributes that keep the app usable on a phone.
const root = resolve(__dirname, '../../..')

describe('index.html', () => {
  const html = readFileSync(resolve(root, 'index.html'), 'utf8')
  it('uses viewport-fit=cover so safe-area insets work', () => {
    expect(html).toContain('width=device-width, initial-scale=1, viewport-fit=cover')
  })
  it('has the theme color, touch icon and manifest', () => {
    expect(html).toContain('<meta name="theme-color" content="#650030" />')
    expect(html).toContain('rel="apple-touch-icon"')
    expect(html).toContain('rel="manifest" href="/manifest.webmanifest"')
  })
  it('has an installable manifest named Molar Money', () => {
    const m = JSON.parse(readFileSync(resolve(root, 'public/manifest.webmanifest'), 'utf8'))
    expect(m.name).toBe('Molar Money')
    expect(m.display).toBe('standalone')
    expect(m.icons.length).toBeGreaterThan(0)
  })
})

describe('index.css', () => {
  const css = readFileSync(resolve(root, 'src/index.css'), 'utf8')
  it('forces 16px text fields on small screens (no iPhone zoom)', () => {
    expect(css).toMatch(/max-width: 767px[\s\S]*font-size: 16px !important/)
  })
  it('makes chip buttons at least 44px tall', () => {
    expect(css).toMatch(/button\.chip[\s\S]*min-height: 44px/)
  })
})

describe('assistant panel on a phone', () => {
  it('is full screen below sm, with 44px close button and a 16px input', async () => {
    const user = userEvent.setup()
    render(
      <TestSessionProvider>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </TestSessionProvider>,
    )
    await user.click(await screen.findByRole('button', { name: 'Open assistant' }))
    const dialog = screen.getByRole('dialog', { name: 'Assistant' })
    expect(dialog.className).toContain('w-full')
    expect(dialog.className).toContain('sm:max-w-[30rem]')
    expect(dialog.parentElement?.className).toContain('h-dvh')
    expect(screen.getByRole('button', { name: 'Close assistant' }).className).toContain('size-11')
    expect(screen.getByRole('textbox', { name: 'Your question' }).className).toContain('text-base')
  })
})
