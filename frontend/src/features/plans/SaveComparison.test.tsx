import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { TestSessionProvider } from "@/test/session"
import { WhichPlanFits } from "./WhichPlanFits"
import PlansPage from "@/pages/Plans/PlansPage"
import { SavedComparisons } from "@/features/planYear/SavedComparisons"
import { useSavedSimulations } from "@/features/planYear/useSavedSimulations"
import type { SavedSimulation } from "@/lib/types/savedSimulations"

const PROCS = [
  { code: "D2740", name: "Crown", category: "major", description: "", synonyms: ["cap"], fee_p50: 1200, fee_p80: 1500 },
].map((procedure) => ({ procedure, score: 1 }))

const plan = (id: string, name: string, share: number) => ({
  plan_id: id, name, monthly_premium: 40, premiums_total: 480, mean: 1000, median: 1000, p10: 900, p90: 2000, min: 0, max: 3000, cheapest_share: share, histogram: [1, 2],
})
const RESPONSE = {
  n: 5000, seed: 42, in_network: true,
  plans: [plan("basic", "Basic", 82), plan("preferred", "Preferred", 10), plan("premium", "Premium", 8)],
  bin_edges: [0, 1000, 3000], winner_plan_id: "basic", reasons: [], assumptions: [],
  disclaimer: "This is an estimate. Your actual cost depends on your dentist's charges and claim review.",
}
const PLANS = ["basic", "preferred", "premium"].map((id) => ({
  id, name: id, description: "", monthly_premium: 1, deductible: 50, annual_max: 1000, coinsurance: { preventive: 1, basic: 0.8, major: 0.5 },
  orthodontia_child: 0, deductible_waived_for: [], frequency: {}, plan_year_start_month: 1, alternate_benefit: true,
}))

const SAVED_REQUEST = {
  members: [{ id: "m-alex", name: "AC", age: 39, care_level: "high", known_care: [{ code: "D2740", count: 1 }] }],
  plan_ids: ["basic", "preferred", "premium"], n: 5000, seed: 42, in_network: false,
}
const rec = (id: string, name: string): SavedSimulation => ({
  id, member_id: "m-jordan", name, request: SAVED_REQUEST as SavedSimulation["request"],
  summary: { winner_plan_id: "basic", winner_name: "Basic", winner_share: 82, plans: [], current_plan_id: "preferred" },
  created_at: "2026-10-04T12:00:00Z", updated_at: "2026-10-04T12:00:00Z",
})

interface Call { url: string; method: string; body: any; auth: string | null }
let calls: Call[]
let list: SavedSimulation[]
let status: number

function stubFetch() {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      const headers = (init?.headers ?? {}) as Record<string, string>
      const body = init?.body ? JSON.parse(String(init.body)) : null
      calls.push({ url, method, body, auth: headers.Authorization ?? null })
      const ok = (d: unknown) => ({ ok: true, status: 200, json: async () => d })
      if (url.includes("/saved-simulations")) {
        if (status !== 200) return { ok: false, status, json: async () => ({ detail: status === 404 ? "Not Found" : "Boom" }) }
        const id = url.split("/saved-simulations/")[1]
        if (method === "GET") return ok(list)
        if (method === "POST") {
          const r = { ...rec("ss-new", body.name), request: body.request }
          list = [r, ...list]
          return { ok: true, status: 201, json: async () => r }
        }
        if (method === "PUT") {
          list = list.map((r) => (r.id === id ? { ...r, ...body } : r))
          return ok(list.find((r) => r.id === id))
        }
        list = list.filter((r) => r.id !== id)
        return { ok: true, status: 204, json: async () => { throw new Error("no body") } }
      }
      if (url.endsWith("/procedures")) return ok(PROCS)
      if (url.endsWith("/simulate")) return ok(RESPONSE)
      if (url.endsWith("/plans")) return ok(PLANS)
      throw new Error(`unexpected ${url}`)
    }),
  )
}

beforeEach(() => {
  list = []
  status = 200
  stubFetch()
})
afterEach(() => vi.restoreAllMocks())

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname}</p>
}

function renderFits() {
  return render(
    <TestSessionProvider signedInId="m-jordan">
      <MemoryRouter>
        <WhichPlanFits planOrder={["basic", "preferred", "premium"]} />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

describe("Save to Plan My Year", () => {
  it("asks for a name, sends only the choices with the token, then links to Plan My Year", async () => {
    const user = userEvent.setup()
    renderFits()
    await screen.findByTestId("sim-basic")
    await user.click(screen.getByRole("button", { name: "Save to Plan My Year" }))
    const input = screen.getByLabelText("Name this comparison") as HTMLInputElement
    expect(input.value).toMatch(/^Basic is best, [A-Z][a-z]{2} \d{1,2}$/)
    await user.clear(input)
    await user.type(input, "Our family")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText(/Saved "Our family"/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "See it in Plan My Year" })).toHaveAttribute("href", "/plan-year")
    const post = calls.find((c) => c.method === "POST" && c.url.includes("/saved-simulations"))!
    expect(post.url).toMatch(/\/members\/m-jordan\/saved-simulations$/)
    expect(post.auth).toBe("Bearer tok-m-jordan")
    expect(Object.keys(post.body).sort()).toEqual(["name", "request"])
    expect(post.body.name).toBe("Our family")
    expect(Object.keys(post.body.request).sort()).toEqual(["in_network", "members", "n", "plan_ids", "seed"])
    expect(post.body.request.plan_ids).toEqual(["basic", "preferred", "premium"])
    expect(JSON.stringify(post.body)).not.toMatch(/cheapest_share|winner|median|p90/)
  })

  it("says saving is not available on a 404", async () => {
    status = 404
    const user = userEvent.setup()
    renderFits()
    await screen.findByTestId("sim-basic")
    await user.click(screen.getByRole("button", { name: "Save to Plan My Year" }))
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Saving comparisons is not available on the server yet.")
  })
})

function Saved() {
  const saved = useSavedSimulations("m-jordan", "tok-m-jordan")
  return <SavedComparisons memberId="m-jordan" saved={saved} names={new Map([["D2740", "Crown"]])} />
}
function renderSaved() {
  return render(
    <MemoryRouter initialEntries={["/plan-year"]}>
      <Routes>
        <Route path="/plan-year" element={<Saved />} />
        <Route path="/plans" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("Saved plan comparisons list", () => {
  it("shows the saved summary from the API, who is covered and the network", async () => {
    list = [rec("ss-1", "Basic is best, Oct 4")]
    renderSaved()
    const card = within(await screen.findByTestId("saved-comparison"))
    expect(card.getByTestId("saved-summary")).toHaveTextContent("Best: Basic, cheapest in 82% of years")
    expect(card.getByText(/AC \(high care\)/)).toBeInTheDocument()
    expect(card.getByText(/Crown for AC/)).toBeInTheDocument()
    expect(card.getByText(/Out of network/)).toBeInTheDocument()
    expect(calls[0].auth).toBe("Bearer tok-m-jordan")
  })

  it("shows an empty state", async () => {
    renderSaved()
    expect(await screen.findByText(/You have not saved a comparison yet/)).toBeInTheDocument()
  })

  it("shows an error with Try again, which retries", async () => {
    status = 500
    const user = userEvent.setup()
    renderSaved()
    expect(await screen.findByRole("alert")).toHaveTextContent(/Boom|server returned an error/)
    status = 200
    list = [rec("ss-1", "One")]
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("saved-comparison")).toBeInTheDocument()
  })

  it("says it is not available yet on a 404", async () => {
    status = 404
    renderSaved()
    expect(await screen.findByText("Saving comparisons is not available on the server yet.")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("renames and deletes after a confirm step", async () => {
    list = [rec("ss-1", "First")]
    const user = userEvent.setup()
    renderSaved()
    await screen.findByTestId("saved-comparison")
    await user.click(screen.getByRole("button", { name: "Rename First" }))
    const input = screen.getByLabelText("New name for First")
    await user.clear(input)
    await user.type(input, "Renamed")
    await user.click(screen.getByRole("button", { name: "Save name" }))
    expect(await screen.findByText("Renamed")).toBeInTheDocument()
    expect(calls.find((c) => c.method === "PUT")!.body).toEqual({ name: "Renamed" })

    await user.click(screen.getByRole("button", { name: "Delete Renamed" }))
    expect(calls.some((c) => c.method === "DELETE")).toBe(false)
    await user.click(screen.getByRole("button", { name: "Keep it" }))
    await user.click(screen.getByRole("button", { name: "Delete Renamed" }))
    await user.click(screen.getByRole("button", { name: "Yes, delete" }))
    await waitFor(() => expect(screen.queryByTestId("saved-comparison")).toBeNull())
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/saved-simulations/ss-1"))).toBe(true)
    expect(screen.getByText(/You have not saved a comparison yet/)).toBeInTheDocument()
  })

  it("Open goes to /plans", async () => {
    list = [rec("ss-1", "First")]
    const user = userEvent.setup()
    renderSaved()
    await screen.findByTestId("saved-comparison")
    await user.click(screen.getByRole("button", { name: "Open First" }))
    expect(await screen.findByTestId("where")).toHaveTextContent("/plans")
  })
})

describe("Open pre-fills the Plans page", () => {
  it("fills people, care level, known care and network, and runs the live simulation", async () => {
    const simCalls = () => calls.filter((c) => c.url.endsWith("/simulate"))
    render(
      <TestSessionProvider signedInId="m-jordan">
        <MemoryRouter initialEntries={[{ pathname: "/plans", state: { simulation: SAVED_REQUEST } }]}>
          <PlansPage />
        </MemoryRouter>
      </TestSessionProvider>,
    )
    await screen.findByTestId("sim-basic")
    await waitFor(() => {
      const last = simCalls()[simCalls().length - 1].body
      expect(last.members.map((m: any) => [m.id, m.care_level, m.known_care])).toEqual([["m-alex", "high", [{ code: "D2740", count: 1 }]]])
      expect(last.in_network).toBe(false)
    }, { timeout: 3000 })
    expect(screen.getByRole("button", { name: /^AC, age 39, covered/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /^Marc, age 41, not covered/ })).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByRole("button", { name: "Out of network" })).toHaveAttribute("aria-pressed", "true")
    expect(within(screen.getByRole("group", { name: "Care level for AC" })).getByRole("button", { name: "High care" })).toHaveAttribute("aria-pressed", "true")
    expect(within(screen.getByTestId("known-row")).getByRole("button", { name: "AC" })).toHaveAttribute("aria-pressed", "true")
  })
})
