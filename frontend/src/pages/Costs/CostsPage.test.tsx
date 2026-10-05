import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { TestSessionProvider } from "@/test/session"
import CostsPage from "./CostsPage"

const PROCS = [
  { code: "D2740", name: "Crown", category: "major", description: "", synonyms: ["cap"], fee_p50: 1200, fee_p80: 1500 },
  { code: "D1110", name: "Cleaning", category: "preventive", description: "", synonyms: [], fee_p50: 120, fee_p80: 160 },
].map((procedure) => ({ procedure, score: 1 }))

function result(inNet: boolean, youPay: number, planPays: number, balance: number) {
  return {
    code: "D2740", name: "Crown", category: "major", in_network: inNet, covered: true, billed: 1200, allowed: 1200,
    deductible_applied: 50, plan_pays: planPays, you_pay: youPay, balance_bill: balance, max_used_after: 0,
    trace: [{ label: "Allowed amount", amount: 1200, note: "What your plan bases payment on." }],
  }
}

function estimateFor(maxUsed: number) {
  return maxUsed === 1100
    ? { in_network: result(true, 800, 400, 0), out_of_network: result(false, 1100, 400, 300) }
    : { in_network: result(true, 625, 575, 0), out_of_network: result(false, 925, 575, 300) }
}

const QUOTE_ITEMS = [
  ["q1", "D3330", "Root canal, molar", 1100, 1100, "urgent", null],
  ["q2", "D2740", "Crown", 1650, 1200, "flexible", "q1"],
  ["q3", "D2392", "Filling, 2-surface", 200, 200, "flexible", null],
  ["q4", "D2392", "Filling, 2-surface", 200, 200, "flexible", null],
  ["q5", "D1110", "Cleaning", 120, 120, "flexible", null],
].map(([id, code, name, quoted_fee, typical_fee, urgency, after]) => ({
  id, code, name, tooth: null, quoted_fee, typical_fee, urgency, after, phase: null, matched: true, confidence: 1, source_line: "",
}))

const TIERS: Record<string, { name: string; prem: number; care: number; plan: number }> = {
  basic: { name: "Basic", prem: 672, care: 400, plan: 200 },
  preferred: { name: "Preferred", prem: 1056, care: 150, plan: 450 },
  premium: { name: "Premium", prem: 1464, care: 90, plan: 510 },
}

interface Call { url: string; body: Record<string, unknown> | null }
let calls: Call[]

function mockApi() {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      calls.push({ url, body })
      const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data })
      if (url.includes("/members/")) {
        const used = url.includes("/m-alex/") ? 1100 : 0
        return ok({ usage: { plan_year: 2026, max_used: used, deductible_met: used ? 50 : 0, visits: 0, cleanings_used: 0 } })
      }
      if (url.endsWith("/procedures")) return ok(PROCS)
      if (url.endsWith("/estimate")) return ok(estimateFor((body!.usage as { max_used: number }).max_used))
      if (url.endsWith("/savings-tips")) {
        const quoted = body!.quoted_fees as Record<string, number> | undefined
        const tips = quoted?.q2
          ? [{ id: "quote_check-q2", kind: "quote_check", title: "Your crown quote looks high", summary: "Ask the office to explain the price.", saving: 150, before: 1650, after: 1500, steps: [], assumptions: [] }]
          : [{ id: "timing", kind: "timing", title: "Wait for January", summary: "A new plan year helps.", saving: 175, before: 800, after: 625, steps: [], assumptions: [] }]
        return ok({ tips, note: "Tips overlap." })
      }
      if (url.endsWith("/questions"))
        return ok({ safety_note: "Never delay urgent or painful care.", sections: [{ id: "s1", title: "Cost and billing", questions: [{ id: "q1", text: "Is this dentist in network?", why: "Out of network can cost more." }] }] })
      if (url.endsWith("/treatment-plan/parse"))
        return ok({ items: QUOTE_ITEMS, unmatched_lines: [], notes: [], mode: "rules" })
      if (url.endsWith("/annual-cost")) {
        const t = TIERS[body!.tier_id as string]
        return ok({
          tier_id: body!.tier_id, tier_name: t.name, covered_people: body!.covered_people, premiums: t.prem, plan_pays: t.plan,
          out_of_pocket_care: t.care, total_cost: t.prem + t.care, per_person: [],
          assumptions: ["Premium is paid for each covered person, 12 months."],
          disclaimer: "This is an estimate. Your actual cost depends on your dentist's charges and claim review.",
        })
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }),
  )
}

function Where() {
  const loc = useLocation()
  return <p data-testid="where">{loc.pathname}:{JSON.stringify((loc.state as { treatments?: unknown[] } | null)?.treatments?.length ?? 0)}</p>
}

function renderPage(memberId = "m-jordan") {
  return render(
    <TestSessionProvider activeId={memberId}>
      <MemoryRouter initialEntries={["/costs"]}>
        <Routes>
          <Route path="/costs" element={<CostsPage />} />
          <Route path="/plan-year" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

beforeEach(() => mockApi())
afterEach(() => vi.restoreAllMocks())

describe("Costs page: estimate", () => {
  it("shows $625 for a fresh year and the out-of-network numbers with balance billing", async () => {
    const user = userEvent.setup()
    const { container } = renderPage("m-jordan")
    expect(screen.getByText(/Your estimate will show up here/)).toBeInTheDocument()
    await user.click(await screen.findByRole("button", { name: "Crown" }))
    await waitFor(() => expect(screen.getByTestId("you-pay")).toHaveTextContent("$625"))
    expect(screen.getByTestId("plan-pays")).toHaveTextContent("$575")
    expect(await screen.findByText("Wait for January")).toBeInTheDocument()
    expect(await screen.findByText("Is this dentist in network?")).toBeInTheDocument()
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Out of network" }))
    expect(screen.getByTestId("you-pay")).toHaveTextContent("$925")
    expect(screen.getByTestId("balance-bill")).toHaveTextContent("$300")

    await user.click(screen.getByRole("button", { name: "Show the math" }))
    expect(within(screen.getByTestId("trace")).getByText("Allowed amount")).toBeInTheDocument()
    expect(container.querySelector("select")).toBeNull()
  })

  it("shows $800 for Mary, who has used $1,100", async () => {
    const user = userEvent.setup()
    renderPage("m-alex")
    await user.click(await screen.findByRole("button", { name: "Crown" }))
    await waitFor(() => expect(screen.getByTestId("you-pay")).toHaveTextContent("$800"))
    const est = calls.find((c) => c.url.endsWith("/estimate"))!.body!
    expect(est.plan_id).toBe("preferred")
    expect((est.usage as { max_used: number }).max_used).toBe(1100)
  })

  it("filters procedures by plain words and shows an error with retry", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("button", { name: "Crown" })
    await user.type(screen.getByLabelText("Search in plain words"), "cap")
    expect(screen.queryByRole("button", { name: "Cleaning" })).toBeNull()
    await user.clear(screen.getByLabelText("Search in plain words"))
    await user.type(screen.getByLabelText("Search in plain words"), "zzz")
    expect(screen.getByText(/No procedures match/)).toBeInTheDocument()
  })

  it("shows an error with a retry when the server is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i)
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })
})

describe("Costs page: quote", () => {
  it("reads the sample quote: 5 matched items, crown flagged high, hands off to Plan My Year", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: "Read my dentist's quote" }))
    expect(screen.getByRole("button", { name: "Read my quote" })).toBeDisabled()
    await user.click(screen.getByRole("button", { name: "Use a sample quote" }))
    await user.click(screen.getByRole("button", { name: "Read my quote" }))

    await waitFor(() => expect(screen.getByTestId("match-count")).toHaveTextContent("5 matched"))
    const cards = screen.getAllByTestId("quote-item")
    expect(cards).toHaveLength(5)
    const crown = cards.find((c) => within(c).queryByText("Crown"))!
    await waitFor(() => expect(within(crown).getByTestId("high-flag")).toBeInTheDocument())
    expect(within(crown).getByText("$1,650")).toBeInTheDocument()
    expect(within(crown).getByText("$1,200")).toBeInTheDocument()
    expect(screen.getAllByTestId("high-flag")).toHaveLength(1)

    await user.click(screen.getByRole("button", { name: "Optimize my year" }))
    expect(screen.getByTestId("where")).toHaveTextContent("/plan-year:5")
  })
})

describe("Costs page: yearly cost", () => {
  it("shows the three tiers with numbers from the API and the assumptions", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole("button", { name: "Yearly cost" }))
    await waitFor(() => expect(screen.getByTestId("total-preferred")).toHaveTextContent("$1,206"))
    expect(screen.getByTestId("total-basic")).toHaveTextContent("$1,072")
    expect(screen.getByTestId("total-premium")).toHaveTextContent("$1,554")
    expect(screen.getByTestId("premiums-preferred")).toHaveTextContent("$1,056")
    expect(screen.getByTestId("care-premium")).toHaveTextContent("$90")
    expect(within(screen.getByTestId("tier-basic")).getByText("Lowest total")).toBeInTheDocument()
    expect(within(screen.getByTestId("tier-preferred")).getByText("Your plan")).toBeInTheDocument()
    expect(screen.getByTestId("assumptions")).toHaveTextContent("Premium is paid for each covered person")
    const sent = calls.filter((c) => c.url.endsWith("/annual-cost")).map((c) => c.body!)
    expect(sent.map((b) => b.tier_id).sort()).toEqual(["basic", "preferred", "premium"])
    expect(sent[0]).toMatchObject({ covered_people: 2, in_network: true, expected_care: [{ code: "D1110", count: 2 }] })
  })
})
