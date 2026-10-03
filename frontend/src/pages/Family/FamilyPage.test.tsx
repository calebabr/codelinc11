import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { SessionProvider } from "@/state/SessionContext"
import FamilyPage from "./FamilyPage"

const tier = { id: "preferred", name: "Preferred", monthly_premium: 40, annual_max: 1500, deductible: 50, preventive_pct: 100, basic_pct: 80, major_pct: 50, ortho_pct: 50 }

const M = {
  jordan: { id: "m_jordan", household_id: "hh_rivera", name: "Jordan Rivera", relationship: "self", age: 41, role: "primary", has_login: true, status: "active", status_note: null },
  alex: { id: "m_alex", household_id: "hh_rivera", name: "Alex Rivera", relationship: "spouse", age: 39, role: "adult", has_login: true, status: "active", status_note: null },
  maya: { id: "m_maya", household_id: "hh_rivera", name: "Maya Rivera", relationship: "child", age: 9, role: "managed", has_login: false, status: "active", status_note: null },
  noah: { id: "m_noah", household_id: "hh_rivera", name: "Noah Rivera", relationship: "child", age: 23, role: "adult", has_login: false, status: "pending", status_note: "Waiting for proof of full-time student status." },
}
const ALL = [M.jordan, M.alex, M.maya, M.noah]

const accounts = [
  { account_id: "a1", email: "jordan@example.com", display_name: "Jordan Rivera", member_id: "m_jordan", role: "primary", household_id: "hh_rivera" },
  { account_id: "a2", email: "alex@example.com", display_name: "Alex Rivera", member_id: "m_alex", role: "adult", household_id: "hh_rivera" },
]

const USED: Record<string, { used: number; ded: number; visits: number; cleanings: number }> = {
  m_jordan: { used: 0, ded: 0, visits: 0, cleanings: 0 },
  m_alex: { used: 1100, ded: 50, visits: 3, cleanings: 1 },
  m_maya: { used: 120, ded: 0, visits: 1, cleanings: 1 },
  m_noah: { used: 0, ded: 0, visits: 0, cleanings: 0 },
}

function overview(id: string) {
  const member = ALL.find((m) => m.id === id)!
  const u = USED[id]
  const pending = member.status === "pending"
  return {
    member,
    plan_tier: tier,
    usage: { plan_year: 2026, max_used: u.used, deductible_met: u.ded, visits: u.visits, cleanings_used: u.cleanings },
    benefits: { plan_name: "Preferred", annual_max: 1500, max_used: u.used, max_remaining: 1500 - u.used, deductible: 50, deductible_met: u.ded, deductible_remaining: 50 - u.ded, months_left: 2, reminder: null },
    reminder: null,
    eligibility: [
      { service: "preventive", label: "Preventive", covered: !pending, plan_share: 1, deductible_applies: false, note: pending ? "Waiting for proof of student status." : "" },
      { service: "basic", label: "Basic", covered: !pending, plan_share: 0.8, deductible_applies: true, note: "" },
      { service: "major", label: "Major", covered: !pending, plan_share: 0.5, deductible_applies: true, note: "" },
      { service: "orthodontia", label: "Orthodontia", covered: id === "m_maya", plan_share: 0.5, deductible_applies: false, note: id === "m_maya" ? "" : "Not covered for adults." },
    ],
    as_of: "2026-11-01",
  }
}

interface Call { url: string; method: string; body: unknown; auth: string | null }
let calls: Call[]

function mockApi() {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, method: init?.method ?? "GET", body, auth: headers.Authorization ?? null })
      const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data })
      if (url.endsWith("/auth/demo-accounts")) return ok(accounts)
      if (url.endsWith("/auth/demo-login")) {
        const id = (body as { member_id: string }).member_id
        const primary = id === "m_jordan"
        return ok({
          token: `tok-${id}`,
          member: ALL.find((m) => m.id === id),
          household: { id: "hh_rivera", name: "Rivera household", plan_tier: tier, members: primary ? ALL : [ALL.find((m) => m.id === id)] },
        })
      }
      if (url.includes("/overview")) return ok(overview(url.split("/members/")[1].split("/")[0]))
      if (url.endsWith("/invites")) return ok({ id: "inv1", household_id: "hh_rivera", invited_by: "m_jordan", member_id: "m_noah", email: (body as { email: string }).email, status: "pending", created_at: "2026-11-01" })
      return { ok: false, status: 404, json: async () => ({}) }
    }),
  )
}

function renderPage() {
  return render(
    <SessionProvider>
      <MemoryRouter>
        <FamilyPage />
      </MemoryRouter>
    </SessionProvider>,
  )
}

beforeEach(mockApi)
afterEach(() => vi.restoreAllMocks())

describe("Family page", () => {
  it("shows four nodes for the Rivera household with login and pending markers", async () => {
    const { container } = renderPage()
    expect(await screen.findByTestId("node-m_jordan")).toBeInTheDocument()
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(4)
    expect(within(screen.getByTestId("node-m_alex")).getByText("Has login")).toBeInTheDocument()
    const maya = within(screen.getByTestId("node-m_maya"))
    expect(maya.queryByText("Has login")).toBeNull()
    expect(maya.getByText("Managed profile")).toBeInTheDocument()
    expect(within(screen.getByTestId("node-m_noah")).getByText("Pending")).toBeInTheDocument()
    expect(container.querySelector("select")).toBeNull()
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
  })

  it("shows each person's own numbers, not a household total", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m_alex"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$400 left"))
    expect(screen.getByTestId("max-used")).toHaveTextContent("$1,100 of $1,500")
    expect(screen.getByTestId("deductible")).toHaveTextContent("$50 of $50")
    expect(screen.getByTestId("visits")).toHaveTextContent("3")
    expect(screen.getByTestId("cleanings")).toHaveTextContent("1")

    await user.click(screen.getByTestId("node-m_maya"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$1,380 left"))
    expect(screen.getByTestId("max-used")).toHaveTextContent("$120 of $1,500")
    expect(screen.getByText(/covered to age 19, or to 26 as a full-time student/)).toBeInTheDocument()
    expect(within(screen.getByTestId("service-orthodontia")).getByText("Available")).toBeInTheDocument()
    expect(calls.every((c) => !c.url.includes("/overview") || c.auth === "Bearer tok-m_jordan")).toBe(true)
  })

  it("shows Noah as pending with his note and pending service chips", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m_noah"))
    expect(await screen.findByTestId("pending-note")).toHaveTextContent("Waiting for proof of full-time student status.")
    await waitFor(() => expect(screen.getByTestId("service-preventive")).toBeInTheDocument())
    expect(within(screen.getByTestId("service-preventive")).getByText("Pending verification")).toBeInTheDocument()
    expect(within(screen.getByTestId("service-orthodontia")).getByText("Pending verification")).toBeInTheDocument()
  })

  it("lets the primary invite an adult without a login and shows the pending invite", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m_noah"))
    await user.click(await screen.findByRole("button", { name: "Invite Noah" }))
    await user.type(screen.getByLabelText("Email address for Noah Rivera"), "noah@example.com")
    await user.click(screen.getByRole("button", { name: "Send invite" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Invite pending for noah@example.com")
    const sent = calls.find((c) => c.url.endsWith("/invites"))!
    expect(sent.method).toBe("POST")
    expect(sent.auth).toBe("Bearer tok-m_jordan")
    expect(sent.body).toEqual({ email: "noah@example.com", member_id: "m_noah" })
  })

  it("offers no invite for a child profile or someone who already has a login", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m_maya"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /^Invite/ })).toBeNull()
    await user.click(screen.getByTestId("node-m_alex"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$400 left"))
    expect(screen.queryByRole("button", { name: /^Invite/ })).toBeNull()
  })

  it("shows only their own node when an adult who is not primary signs in", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Alex Rivera (adult)" }))
    await waitFor(() => expect(screen.getAllByTestId(/^node-/)).toHaveLength(1))
    expect(screen.getByTestId("node-m_alex")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$400 left"))
    expect(screen.queryByRole("button", { name: /^Invite/ })).toBeNull()
    expect(screen.getByText(/You can see your own benefits/)).toBeInTheDocument()
  })

  it("switches the active member with View as", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m_maya"))
    await user.click(await screen.findByRole("button", { name: "View as Maya" }))
    expect(await screen.findByRole("button", { name: "Viewing as Maya" })).toBeDisabled()
  })

  it("shows an error with a retry when the server is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i)
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })
})
