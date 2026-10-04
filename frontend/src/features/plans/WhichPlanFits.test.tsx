import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { TestSessionProvider } from "@/test/session"
import { WhichPlanFits } from "./WhichPlanFits"

const PROCS = [
  { code: "D2740", name: "Crown", category: "major", description: "", synonyms: ["cap"], fee_p50: 1200, fee_p80: 1500 },
  { code: "D2392", name: "Filling", category: "basic", description: "", synonyms: [], fee_p50: 200, fee_p80: 260 },
].map((procedure) => ({ procedure, score: 1 }))

const plan = (id: string, name: string, premium: number, share: number, median: number, p90: number, hist: number[]) => ({
  plan_id: id,
  name,
  monthly_premium: premium,
  premiums_total: premium * 12 * 4,
  mean: median,
  median,
  p10: median - 100,
  p90,
  min: 0,
  max: p90 + 500,
  cheapest_share: share,
  histogram: hist,
})

const RESPONSE = {
  n: 5000,
  seed: 42,
  in_network: true,
  plans: [
    plan("premium", "Premium", 61, 55, 3111, 4222, [1, 5, 2]),
    plan("basic", "Basic", 28, 15, 1777, 3999, [3, 2, 1]),
    plan("preferred", "Preferred", 44, 30, 2468, 4101, [2, 4, 1]),
  ],
  bin_edges: [1000, 2000, 3000, 5000],
  winner_plan_id: "premium",
  reasons: ["Premium costs more each month, but pays more on major care in a bad year."],
  assumptions: ["Odds are synthetic placeholders, not claims data."],
  disclaimer: "This is an estimate. Your actual cost depends on your dentist's charges and claim review.",
}

interface Call {
  url: string
  body: any
  auth: string | null
}
let calls: Call[] = []
let simStatus = 200
let simDelay = 0

function stubFetch() {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith("/procedures")) return { ok: true, status: 200, json: async () => PROCS }
      if (url.endsWith("/simulate")) {
        const headers = (init?.headers ?? {}) as Record<string, string>
        calls.push({ url, body: JSON.parse(String(init?.body)), auth: headers.Authorization ?? null })
        if (simDelay) await new Promise((r) => setTimeout(r, simDelay))
        if (simStatus >= 400) return { ok: false, status: simStatus, json: async () => ({}) }
        return { ok: true, status: 200, json: async () => RESPONSE }
      }
      throw new Error(`unexpected ${url}`)
    }),
  )
}

function renderIt(signedInId = "m-jordan") {
  return render(
    <TestSessionProvider signedInId={signedInId}>
      <MemoryRouter>
        <WhichPlanFits planOrder={["basic", "preferred", "premium"]} />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

beforeEach(() => {
  simStatus = 200
  simDelay = 0
  stubFetch()
})
afterEach(() => vi.restoreAllMocks())

describe("Which plan fits us?", () => {
  it("shows one card per plan in plan order with the API's numbers", async () => {
    const { container } = renderIt()
    const premium = within(await screen.findByTestId("sim-premium"))
    expect(premium.getByText("55%", { selector: "p" })).toBeInTheDocument()
    expect(premium.getByText("Cheapest in 55% of years")).toBeInTheDocument()
    expect(premium.getByText("$3,111")).toBeInTheDocument()
    expect(premium.getByText("$4,222")).toBeInTheDocument()
    expect(premium.getByText("$2,928")).toBeInTheDocument()
    expect(premium.getByText("Best for your family")).toBeInTheDocument()
    expect(within(screen.getByTestId("sim-basic")).queryByText("Best for your family")).toBeNull()
    expect(within(screen.getByTestId("sim-preferred")).getByText("Your plan")).toBeInTheDocument()
    const order = screen.getAllByRole("article").map((a) => a.getAttribute("data-testid"))
    expect(order).toEqual(["sim-basic", "sim-preferred", "sim-premium"])
    expect(screen.getByTestId("winner-differs")).toHaveTextContent("Your family is on Preferred, but Premium")
    expect(screen.getByTestId("sim-reasons")).toHaveTextContent("pays more on major care")
    expect(screen.getByTestId("sim-assumptions")).toHaveTextContent("synthetic placeholders")
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
    expect(screen.getByText(/not a prediction for your family/)).toBeInTheDocument()
    expect(container.querySelector("select")).toBeNull()
  })

  it("draws the chart from the histogram and has a table alternative", async () => {
    renderIt()
    await screen.findByTestId("sim-premium")
    const chart = screen.getByTestId("distribution-chart")
    expect(chart).toHaveAttribute("role", "img")
    expect(chart.querySelectorAll("rect")).toHaveLength(9)
    const table = within(screen.getByTestId("sim-table"))
    expect(table.getByRole("row", { name: /Premium 55% of years \$3,111 \$4,222/ })).toBeInTheDocument()
  })

  it("sends everyone on average care by default, with the session token", async () => {
    renderIt()
    await screen.findByTestId("sim-premium")
    expect(calls).toHaveLength(1)
    expect(calls[0].auth).toBe("Bearer tok-m-jordan")
    expect(calls[0].body.n).toBe(5000)
    expect(calls[0].body.seed).toBe(42)
    expect(calls[0].body.in_network).toBe(true)
    expect(calls[0].body.members.map((m: any) => [m.id, m.age, m.care_level, m.known_care])).toEqual([
      ["m-jordan", 41, "average", []],
      ["m-alex", 39, "average", []],
      ["m-maya", 9, "average", []],
      ["m-noah", 23, "average", []],
    ])
  })

  it("shows the loading skeleton first", async () => {
    simDelay = 100
    renderIt()
    expect(await screen.findByTestId("sim-skeleton")).toBeInTheDocument()
    await screen.findByTestId("sim-premium")
    expect(screen.queryByTestId("sim-skeleton")).toBeNull()
  })

  it("a care-level change recomputes with the right body", async () => {
    const user = userEvent.setup()
    renderIt()
    await screen.findByTestId("sim-premium")
    const alexGroup = within(screen.getByRole("group", { name: "Care level for AC" }))
    await user.click(alexGroup.getByRole("button", { name: "High care" }))
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 3000 })
    const alex = calls[1].body.members.find((m: any) => m.id === "m-alex")
    expect(alex.care_level).toBe("high")
    expect(calls[1].body.members.find((m: any) => m.id === "m-jordan").care_level).toBe("average")
    expect(alexGroup.getByRole("button", { name: "High care" })).toHaveAttribute("aria-pressed", "true")
  })

  it("known care appears in the request, assigned to a person", async () => {
    const user = userEvent.setup()
    renderIt()
    await screen.findByTestId("sim-premium")
    await user.click(await screen.findByRole("button", { name: "Try AC's crown" }))
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 3000 })
    const alex = calls[1].body.members.find((m: any) => m.id === "m-alex")
    expect(alex.known_care).toEqual([{ code: "D2740", count: 1 }])
    expect(within(screen.getByTestId("known-row")).getByRole("button", { name: "AC" })).toHaveAttribute("aria-pressed", "true")

    await user.click(screen.getByRole("button", { name: "Add Filling to known care" }))
    await user.click(within(screen.getAllByTestId("known-row")[1]).getByRole("button", { name: "Hannah" }))
    await waitFor(() => {
      const last = calls[calls.length - 1].body
      expect(last.members.find((m: any) => m.id === "m-noah").known_care).toEqual([{ code: "D2392", count: 1 }])
    }, { timeout: 3000 })
  })

  it("toggling a person off removes them, and the last person stays on", async () => {
    const user = userEvent.setup()
    renderIt()
    await screen.findByTestId("sim-premium")
    await user.click(screen.getByRole("button", { name: /^Sophia, age 9/ }))
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 3000 })
    expect(calls[1].body.members.map((m: any) => m.id)).toEqual(["m-jordan", "m-alex", "m-noah"])

    await user.click(screen.getByRole("button", { name: /^AC, age 39/ }))
    await user.click(screen.getByRole("button", { name: /^Hannah, age 23/ }))
    await user.click(screen.getByRole("button", { name: /^Marc, age 41/ }))
    expect(screen.getByRole("button", { name: /^Marc, age 41, covered/ })).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => expect(calls[calls.length - 1].body.members.map((m: any) => m.id)).toEqual(["m-jordan"]), { timeout: 3000 })
  })

  it("keeps the person toggles and the 'How we estimated this' summary at least 44 px tall (phone audit)", async () => {
    renderIt()
    await screen.findByTestId("sim-premium")
    expect(screen.getByRole("button", { name: /^Marc, age 41, covered/ }).className).toContain("min-h-11")
    expect(screen.getByText("How we estimated this").className).toContain("min-h-11")
  })

  it("the network toggle is sent as in_network", async () => {
    const user = userEvent.setup()
    renderIt()
    await screen.findByTestId("sim-premium")
    await user.click(screen.getByRole("button", { name: "Out of network" }))
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 3000 })
    expect(calls[1].body.in_network).toBe(false)
  })

  it("says the simulation is not available on a 404", async () => {
    simStatus = 404
    renderIt()
    expect(await screen.findByText(/Simulation is not available on the server yet/)).toBeInTheDocument()
    expect(screen.queryByTestId("sim-premium")).toBeNull()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("shows a friendly error with Try again, which retries", async () => {
    simStatus = 500
    const user = userEvent.setup()
    renderIt()
    expect(await screen.findByRole("alert")).toHaveTextContent(/server returned an error \(500\)/)
    simStatus = 200
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("sim-premium", undefined, { timeout: 3000 })).toBeInTheDocument()
  })

  it("a non-primary sees only themselves", async () => {
    renderIt("m-alex")
    await screen.findByTestId("sim-premium")
    expect(screen.getAllByTestId(/^who-/)).toHaveLength(1)
    expect(calls[0].auth).toBe("Bearer tok-m-alex")
    expect(calls[0].body.members.map((m: any) => m.id)).toEqual(["m-alex"])
  })
})
