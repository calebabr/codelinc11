import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { TestSessionProvider } from "@/test/session"
import PlanYearPage from "./PlanYearPage"

const PROCS = [
  { code: "D3330", name: "Root canal, molar", category: "basic", description: "", synonyms: [], fee_p50: 1100, fee_p80: 1400 },
  { code: "D2740", name: "Crown", category: "major", description: "", synonyms: ["cap"], fee_p50: 1200, fee_p80: 1500 },
  { code: "D2392", name: "Filling, 2-surface", category: "basic", description: "", synonyms: [], fee_p50: 200, fee_p80: 260 },
].map((procedure) => ({ procedure, score: 1 }))

function schedule(total: number, baseline: number, savings: number) {
  return {
    items: [
      { id: "t1", code: "D3330", name: "Root canal, molar", category: "basic", year_offset: 0, month: 11, plan_pays: 400, you_pay: 700, note: "Urgent, so it stays this year." },
      { id: "t2", code: "D2740", name: "Crown", category: "major", year_offset: 1, month: 1, plan_pays: 575, you_pay: 625, note: "Waits for the new plan year." },
    ],
    years: [
      { year_offset: 0, label: "This plan year", plan_pays: 400, you_pay: 700, max_used_end: 1500, max_remaining_end: 0 },
      { year_offset: 1, label: "Next plan year", plan_pays: 895, you_pay: 705, max_used_end: 895, max_remaining_end: 605 },
    ],
    total_you_pay: total,
    baseline_you_pay: baseline,
    savings,
    baseline_items: [],
    reasons: ["The root canal is urgent, so it stays in this plan year."],
  }
}

interface Call { url: string; body: Record<string, unknown> | null }
let calls: Call[]

function mockApi(opts: { overviewFails?: boolean } = {}) {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      calls.push({ url, body })
      const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data })
      if (url.includes("/members/")) {
        if (opts.overviewFails) return { ok: false, status: 404, json: async () => ({ detail: "nope" }) }
        const id = url.split("/members/")[1].split("/")[0]
        const usage = id === "m-alex" ? { plan_year: 2026, max_used: 1100, deductible_met: 50, visits: 3, cleanings_used: 0 } : { plan_year: 2026, max_used: 0, deductible_met: 0, visits: 0, cleanings_used: 0 }
        return ok({ usage })
      }
      if (url.endsWith("/procedures")) return ok(PROCS)
      if (url.endsWith("/schedule")) {
        const used = (body?.usage as { max_used: number }).max_used
        return ok(used === 1100 ? schedule(1405, 2300, 895) : schedule(900, 1000, 100))
      }
      if (url.endsWith("/savings-tips"))
        return ok({ tips: [{ id: "tip1", kind: "timing", title: "Move the crown to January", summary: "Waiting for the new year helps.", saving: 175, before: 800, after: 625, steps: [], assumptions: [] }], note: "Tips overlap." })
      if (url.endsWith("/questions"))
        return ok({ safety_note: "Never delay urgent or painful care.", sections: [{ id: "s1", title: "Cost and billing", questions: [{ id: "q1", text: "Is this dentist in network?", why: "Out of network can cost more." }] }] })
      if (url.endsWith("/benefits-status"))
        return ok({ plan_name: "Preferred", annual_max: 1500, max_used: 1100, max_remaining: 400, deductible: 50, deductible_met: 50, months_left: 2, reminder: null })
      return { ok: false, status: 404, json: async () => ({}) }
    }),
  )
}

function renderPage(initialMemberId = "m-alex") {
  return render(
    <TestSessionProvider activeId={initialMemberId}>
      <MemoryRouter>
        <PlanYearPage />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

beforeEach(() => mockApi())
afterEach(() => vi.restoreAllMocks())

describe("Plan My Year page", () => {
  it("shows an empty state, the disclaimer and the urgent-care note", async () => {
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Plan My Year" })).toBeInTheDocument()
    expect(screen.getByText(/Add a treatment, or try the demo case/)).toBeInTheDocument()
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
    expect(screen.getByText(/should never wait/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId("left-this-year")).toHaveTextContent("$400 left this year"))
  })

  it("demo case for Alex shows $2,300 to $1,405 and saves $895, root canal this year, crown in January", async () => {
    const user = userEvent.setup()
    const { container } = renderPage()
    await user.click(screen.getByRole("button", { name: "Try the demo case" }))

    await waitFor(() => expect(screen.getByTestId("savings-total")).toHaveTextContent("$895"))
    expect(screen.getByTestId("baseline-total")).toHaveTextContent("$2,300")
    expect(screen.getByTestId("optimized-total")).toHaveTextContent("$1,405")

    const thisYear = within(screen.getByRole("region", { name: "This plan year" }))
    expect(thisYear.getByText("November")).toBeInTheDocument()
    expect(thisYear.getByText("Root canal, molar")).toBeInTheDocument()
    const nextYear = within(screen.getByRole("region", { name: "Next plan year" }))
    expect(nextYear.getByText("January")).toBeInTheDocument()
    expect(nextYear.getByText("Crown")).toBeInTheDocument()
    expect(screen.getByRole("separator", { name: "Your plan year resets" })).toBeInTheDocument()

    expect(screen.getByText("The root canal is urgent, so it stays in this plan year.")).toBeInTheDocument()
    expect(await screen.findByText("Move the crown to January")).toBeInTheDocument()
    expect(screen.getByText("Could save $175")).toBeInTheDocument()
    expect(await screen.findByText("Is this dentist in network?")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Add reminders to my calendar" })).toHaveAttribute("href", expect.stringContaining("/reminders.ics"))
    expect(container.querySelector("select")).toBeNull()

    const sent = calls.find((c) => c.url.endsWith("/schedule"))!.body!
    expect(sent.plan_id).toBe("preferred")
    expect(sent.current_month).toBe(11)
    expect(sent.usage).toEqual({ max_used: 1100, deductible_met: 50, history: [] })
    expect((sent.items as unknown[]).length).toBe(4)
  })

  it("recomputes with the new member's usage when the member changes", async () => {
    const user = userEvent.setup()
    const { rerender } = renderPage("m-alex")
    await user.click(screen.getByRole("button", { name: "Try the demo case" }))
    await waitFor(() => expect(screen.getByTestId("savings-total")).toHaveTextContent("$895"))

    rerender(
      <TestSessionProvider activeId="m-jordan" key="jordan">
        <MemoryRouter>
          <PlanYearPage />
        </MemoryRouter>
      </TestSessionProvider>,
    )
    await user.click(screen.getByRole("button", { name: "Try the demo case" }))
    await waitFor(() => expect(screen.getByTestId("savings-total")).toHaveTextContent("$100"))
    const last = [...calls].reverse().find((c) => c.url.endsWith("/schedule"))!
    expect((last.body!.usage as { max_used: number }).max_used).toBe(0)
  })

  it("adds a treatment by tapping a card and sets urgency with toggle buttons", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Add Crown" }))
    const row = within(screen.getByTestId("treatment-row"))
    const urgent = row.getByRole("button", { name: "Urgent" })
    expect(urgent).toHaveAttribute("aria-pressed", "false")
    await user.click(urgent)
    expect(urgent).toHaveAttribute("aria-pressed", "true")
    await waitFor(() => {
      const c = [...calls].reverse().find((x) => x.url.endsWith("/schedule"))!
      expect((c.body!.items as { urgency: string }[])[0].urgency).toBe("urgent")
    })
    await user.click(screen.getByRole("button", { name: "Remove Crown" }))
    expect(screen.getByText(/Add a treatment, or try the demo case/)).toBeInTheDocument()
  })

  it("shows an error with a retry when the server is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    renderPage()
    expect((await screen.findAllByRole("alert"))[0]).toHaveTextContent(/can't reach the server/i)
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  it("shows a clear error, not made-up numbers, when the overview cannot be loaded", async () => {
    mockApi({ overviewFails: true })
    renderPage("m-alex")
    expect(await screen.findByRole("alert")).toHaveTextContent("nope")
    expect(screen.queryByTestId("left-this-year")).toBeNull()
  })
})
