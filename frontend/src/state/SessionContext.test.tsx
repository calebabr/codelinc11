import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { AppRoutes } from "@/App"
import { ACCOUNTS, householdFor } from "@/test/session"
import { SessionProvider } from "./SessionContext"

interface Call {
  url: string
  method: string
  body: { member_id?: string; tier_id?: string } | null
  auth: string | null
}
let calls: Call[]
let down = false
let tier = "preferred"
const PLAN = (id: string, name: string, premium: number) => ({
  id,
  name,
  description: "",
  monthly_premium: premium,
  deductible: 50,
  deductible_waived_for: ["preventive"],
  annual_max: 1500,
  coinsurance: { preventive: 1, basic: 0.8, major: 0.5 },
  frequency: {},
  plan_year_start_month: 1,
  orthodontia_child: 0.5,
  alternate_benefit: true,
})

function mockApi() {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (down) throw new Error("offline")
      const url = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, method: init?.method ?? "GET", body, auth: headers.Authorization ?? null })
      const ok = (d: unknown) => ({ ok: true, status: 200, json: async () => d })
      if (url.endsWith("/auth/demo-accounts")) return ok(ACCOUNTS)
      if (url.endsWith("/auth/demo-login")) {
        const h = householdFor(body.member_id)
        return ok({ token: `tok-${body.member_id}`, member: h.members.find((m) => m.id === body.member_id), household: h })
      }
      if (init?.method === "PUT" && url.endsWith("/households/hh-rivera/plan")) {
        tier = body.tier_id!
        const h = householdFor("m-jordan")
        return ok({ ...h, plan_tier: { ...h.plan_tier, id: tier, name: "Premium" } })
      }
      if (url.endsWith("/plans")) return ok([PLAN("basic", "Basic", 28), PLAN("preferred", "Preferred", 44), PLAN("premium", "Premium", 61)])
      const hh = url.match(/\/households\/([^/]+)$/)
      if (hh) return ok(householdFor(headers.Authorization!.replace("Bearer tok-", "")))
      return ok([])
    }),
  )
}

function renderApp(path = "/plans") {
  return render(
    <SessionProvider>
      <MemoryRouter initialEntries={[path]}>
        <AppRoutes />
      </MemoryRouter>
    </SessionProvider>,
  )
}

beforeEach(() => {
  down = false
  tier = "preferred"
  sessionStorage.clear()
  mockApi()
})
afterEach(() => vi.restoreAllMocks())

describe("SessionProvider", () => {
  it("signs in as the primary (Jordan) by default and loads the household with the token", async () => {
    renderApp()
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(await screen.findByTestId("household-label")).toHaveTextContent("Rivera household")
    expect(screen.getByTestId("active-member-label")).toHaveTextContent("Jordan Rivera")
    const login = calls.find((c) => c.url.endsWith("/auth/demo-login"))!
    expect(login.method).toBe("POST")
    expect(login.body).toEqual({ member_id: "m-jordan" })
    const hh = calls.find((c) => c.url.endsWith("/households/hh-rivera"))!
    expect(hh.auth).toBe("Bearer tok-m-jordan")
    expect(sessionStorage.getItem("dental.signedInMemberId")).toBe("m-jordan")
  })

  it("remembers the chosen person for this tab", async () => {
    sessionStorage.setItem("dental.signedInMemberId", "m-alex")
    renderApp()
    await waitFor(() => expect(screen.getByTestId("active-member-label")).toHaveTextContent("Alex Rivera"))
    expect(calls.find((c) => c.url.endsWith("/auth/demo-login"))!.body).toEqual({ member_id: "m-alex" })
  })

  it("shows a clear error with a retry when the server is down, then recovers", async () => {
    const user = userEvent.setup()
    down = true
    renderApp()
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i)
    down = false
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("household-label")).toBeInTheDocument()
  })

  it("signs out to the login page, and the login cards sign in again", async () => {
    const user = userEvent.setup()
    renderApp("/plans")
    await user.click(await screen.findByRole("button", { name: "Sign out" }))
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument()
    expect(sessionStorage.getItem("dental.signedInMemberId")).toBeNull()
    await user.click(await screen.findByRole("button", { name: /Alex Rivera/ }))
    await waitFor(() => expect(screen.getByTestId("active-member-label")).toHaveTextContent("Alex Rivera"))
    expect(sessionStorage.getItem("dental.signedInMemberId")).toBe("m-alex")
  })

  it("changePlan updates the plan name in the utility bar without a reload", async () => {
    const user = userEvent.setup()
    renderApp("/plans")
    expect(await screen.findByTestId("plan-label")).toHaveTextContent("Preferred plan")
    await user.click(await screen.findByTestId("tier-premium"))
    await user.click(screen.getByRole("button", { name: "Switch to this plan" }))
    await user.click(screen.getByRole("button", { name: "Yes, switch to Premium" }))
    await waitFor(() => expect(screen.getByTestId("plan-label")).toHaveTextContent("Premium plan"))
    expect(tier).toBe("premium")
    expect(calls.find((c) => c.method === "PUT")!.auth).toBe("Bearer tok-m-jordan")
  })
})
