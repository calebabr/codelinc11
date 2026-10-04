import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

// Clerk needs a real browser session. Tests run as a signed-in Clerk user; the household
// profile still comes from SessionProvider / TestSessionProvider.
vi.mock('@clerk/react', () => ({
  ClerkProvider: ({ children }: { children: unknown }) => children,
  useAuth: () => ({ isLoaded: true, isSignedIn: true, userId: 'user_test', getToken: async () => 'clerk-tok' }),
  useClerk: () => ({ signOut: vi.fn(async () => {}) }),
  SignIn: () => null,
  SignUp: () => null,
}))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// jsdom lacks these browser APIs used by Radix / Recharts.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub
}
if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView || (() => {})
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture || (() => false)
