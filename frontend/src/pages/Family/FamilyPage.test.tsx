import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { ALL_MEMBERS, MEMBERS, TestSessionProvider, TIER } from "@/test/session"
import FamilyPage from "./FamilyPage"

const tier = TIER
// The server says Noah already has a login; these tests need him without one so the invite shows.
const ALL = ALL_MEMBERS.map((m) => (m.id === "m-noah" ? { ...MEMBERS.noah, has_login: false } : m))

const USED: Record<string, { used: number; ded: number; visits: number; cleanings: number }> = {
  "m-jordan": { used: 0, ded: 0, visits: 0, cleanings: 0 },
  "m-alex": { used: 1100, ded: 50, visits: 3, cleanings: 1 },
  "m-maya": { used: 120, ded: 0, visits: 1, cleanings: 1 },
  "m-noah": { used: 0, ded: 0, visits: 0, cleanings: 0 },
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
      { service: "orthodontia", label: "Orthodontia", covered: id === "m-maya", plan_share: 0.5, deductible_applies: false, note: id === "m-maya" ? "" : "Not covered for adults." },
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
      if (url.includes("/overview")) return ok(overview(url.split("/members/")[1].split("/")[0]))
      if (url.endsWith("/invites")) return ok({ id: "inv1", household_id: "hh-rivera", invited_by: "m-jordan", member_id: "m-noah", email: (body as { email: string }).email, status: "pending", created_at: "2026-11-01" })
      return { ok: false, status: 404, json: async () => ({}) }
    }),
  )
}

function renderPage() {
  return render(
    <TestSessionProvider members={ALL}>
      <MemoryRouter>
        <FamilyPage />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

beforeEach(mockApi)
afterEach(() => vi.restoreAllMocks())

describe("Family page", () => {
  it("shows four nodes for the Rivera household with login and pending markers", async () => {
    const { container } = renderPage()
    expect(await screen.findByTestId("node-m-jordan")).toBeInTheDocument()
    expect(screen.getAllByTestId(/^node-/)).toHaveLength(4)
    expect(within(screen.getByTestId("node-m-alex")).getByText("Has login")).toBeInTheDocument()
    const maya = within(screen.getByTestId("node-m-maya"))
    expect(maya.queryByText("Has login")).toBeNull()
    expect(maya.getByText("Managed profile")).toBeInTheDocument()
    expect(within(screen.getByTestId("node-m-noah")).getByText("Pending")).toBeInTheDocument()
    expect(container.querySelector("select")).toBeNull()
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
  })

  it("shows each person's own numbers, not a household total", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-alex"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$400 left"))
    expect(screen.getByTestId("max-used")).toHaveTextContent("$1,100 of $1,500")
    expect(screen.getByTestId("deductible")).toHaveTextContent("$50 of $50")
    expect(screen.getByTestId("visits")).toHaveTextContent("3")
    expect(screen.getByTestId("cleanings")).toHaveTextContent("1")

    await user.click(screen.getByTestId("node-m-maya"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$1,380 left"))
    expect(screen.getByTestId("max-used")).toHaveTextContent("$120 of $1,500")
    expect(screen.getByText(/covered to age 19, or to 26 as a full-time student/)).toBeInTheDocument()
    expect(within(screen.getByTestId("service-orthodontia")).getByText("Available")).toBeInTheDocument()
    expect(calls.every((c) => !c.url.includes("/overview") || c.auth === "Bearer tok-m-jordan")).toBe(true)
  })

  it("shows Noah as pending with his note and pending service chips", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-noah"))
    expect(await screen.findByTestId("pending-note")).toHaveTextContent("Waiting for proof of full-time student status.")
    await waitFor(() => expect(screen.getByTestId("service-preventive")).toBeInTheDocument())
    expect(within(screen.getByTestId("service-preventive")).getByText("Pending verification")).toBeInTheDocument()
    expect(within(screen.getByTestId("service-orthodontia")).getByText("Pending verification")).toBeInTheDocument()
  })

  it("lets the primary invite an adult without a login and shows the pending invite", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-noah"))
    await user.click(await screen.findByRole("button", { name: "Invite Noah" }))
    await user.type(screen.getByLabelText("Email address for Noah Rivera"), "noah@example.com")
    await user.click(screen.getByRole("button", { name: "Send invite" }))
    expect(await screen.findByRole("status")).toHaveTextContent("Invite pending for noah@example.com")
    const sent = calls.find((c) => c.url.endsWith("/invites"))!
    expect(sent.method).toBe("POST")
    expect(sent.auth).toBe("Bearer tok-m-jordan")
    expect(sent.body).toEqual({ email: "noah@example.com", member_id: "m-noah" })
  })

  it("offers no invite for a child profile or someone who already has a login", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-maya"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toBeInTheDocument())
    expect(screen.queryByRole("button", { name: /^Invite/ })).toBeNull()
    await user.click(screen.getByTestId("node-m-alex"))
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$400 left"))
    expect(screen.queryByRole("button", { name: /^Invite/ })).toBeNull()
  })

  it("shows only their own node when an adult who is not primary signs in", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Alex Rivera (adult)" }))
    await waitFor(() => expect(screen.getAllByTestId(/^node-/)).toHaveLength(1))
    expect(screen.getByTestId("node-m-alex")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId("max-left")).toHaveTextContent("$400 left"))
    expect(screen.queryByRole("button", { name: /^Invite/ })).toBeNull()
    expect(screen.getByText(/You can see your own benefits/)).toBeInTheDocument()
  })

  it("switches the active member with View as", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("node-m-maya"))
    await user.click(await screen.findByRole("button", { name: "View as Maya" }))
    expect(await screen.findByRole("button", { name: "Viewing as Maya" })).toBeDisabled()
  })
})
