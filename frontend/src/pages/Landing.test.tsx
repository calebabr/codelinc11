import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { AppRoutes } from "@/App"
import { ACCOUNTS, ALL_MEMBERS, TIER } from "@/test/session"
import { FAMILY_KEY, SessionProvider } from "@/state/SessionContext"

vi.setConfig({ testTimeout: 20000 })

let bodies: Record<string, unknown>[]

class IntersectionObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", IntersectionObserverStub)
  bodies = []
  sessionStorage.clear()
  localStorage.clear()
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const ok = (d: unknown) => new Response(JSON.stringify(d), { status: 200 })
      if (url.includes("/auth/demo-accounts")) return ok(ACCOUNTS)
      if (url.endsWith("/auth/demo-login")) {
        bodies.push(JSON.parse(String(init?.body)))
        const members = ALL_MEMBERS.map((m) => ({ ...m, id: `${m.id}.aaaaaa`, household_id: "hh-rivera.aaaaaa" }))
        const household = { id: "hh-rivera.aaaaaa", name: "Lincoln household", plan_tier: TIER, members }
        return ok({ token: "t", member: members[0], household, sandbox: { household_id: "hh-rivera.aaaaaa", expires_at: "x" } })
      }
      if (url.includes("/households/")) {
        const members = ALL_MEMBERS.map((m) => ({ ...m, id: `${m.id}.aaaaaa`, household_id: "hh-rivera.aaaaaa" }))
        return ok({ id: "hh-rivera.aaaaaa", name: "Lincoln household", plan_tier: TIER, members })
      }
      return ok([])
    }),
  )
})
afterEach(() => vi.restoreAllMocks())

function renderWelcome() {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={["/welcome"]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  )
}

describe("landing page", () => {
  it("has a 'Try the demo' button in the hero and in the nav that signs in with one tap", async () => {
    const user = userEvent.setup()
    renderWelcome()
    const buttons = await screen.findAllByRole("button", { name: /Try the demo/ }, { timeout: 8000 })
    expect(buttons.length).toBeGreaterThanOrEqual(2) // nav and hero
    await user.click(buttons[buttons.length - 1])
    expect(await screen.findByTestId("household-label")).toHaveTextContent("Lincoln household")
    expect(bodies).toEqual([{ member_id: "m-jordan", sandbox: true }])
  })

  it("offers 'Continue your demo family' to a visitor who has one", async () => {
    localStorage.setItem(FAMILY_KEY, JSON.stringify({ v: 1, household_id: "hh-rivera.aaaaaa", naming_pending: false }))
    renderWelcome()
    expect((await screen.findAllByRole("button", { name: /Continue your demo family/ }, { timeout: 8000 })).length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByRole("button", { name: /Try the demo/ })).toBeNull()
  })
})
