import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { TestSessionProvider } from "@/test/session"
import PlanYearPage from "./PlanYearPage"
import { resetDraftStoreForTests, STORAGE_KEY } from "@/features/planYear/draftStore"

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

interface Rec { id: string; member_id: string; name: string; items: { id: string; code: string; urgency: string; after: string | null }[]; created_at: string; updated_at: string }
const S2_ITEMS = [
  { id: "t1", code: "D3330", urgency: "urgent", after: null },
  { id: "t2", code: "D2740", urgency: "flexible", after: "t1" },
  { id: "t3", code: "D2392", urgency: "flexible", after: null },
  { id: "t4", code: "D2392", urgency: "flexible", after: null },
]
let saved: Rec[]
let savedStatus: number

function mockApi(opts: { overviewFails?: boolean; savedStatus?: number } = {}) {
  calls = []
  savedStatus = opts.savedStatus ?? 200
  saved = [{ id: "sp1", member_id: "m-alex", name: "AC S2 case", items: S2_ITEMS, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }]
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      calls.push({ url, body })
      const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => data })
      if (url.includes("/saved-simulations")) return { ok: false, status: 404, json: async () => ({ detail: "Not Found" }) }
      if (url.includes("/saved-plans")) {
        const method = init?.method ?? "GET"
        const mid = url.split("/members/")[1].split("/")[0]
        const pid = url.split("/saved-plans/")[1]
        if (savedStatus !== 200) return { ok: false, status: savedStatus, json: async () => ({ detail: "Not Found" }) }
        if (method === "GET") return ok(mid === "m-alex" ? saved : [])
        if (method === "POST") {
          const rec = { id: "sp-new", member_id: mid, name: String(body!.name), items: body!.items as Rec["items"], created_at: "2026-10-03T00:00:00Z", updated_at: "2026-10-03T00:00:00Z" }
          saved = [rec, ...saved]
          return { ok: true, status: 201, json: async () => rec }
        }
        if (method === "PUT") {
          saved = saved.map((r) => (r.id === pid ? { ...r, ...(body as object) } : r))
          return ok(saved.find((r) => r.id === pid))
        }
        saved = saved.filter((r) => r.id !== pid)
        return { ok: true, status: 204, json: async () => { throw new Error("no body") } }
      }
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

beforeEach(() => {
  resetDraftStoreForTests()
  mockApi()
})
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

  it("demo case for AC shows $2,300 to $1,405 and saves $895, root canal this year, crown in January", async () => {
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
    expect(screen.getAllByRole("button", { name: "Try again" }).length).toBeGreaterThan(0)
  })

  it("shows a clear error, not made-up numbers, when the overview cannot be loaded", async () => {
    mockApi({ overviewFails: true })
    renderPage("m-alex")
    expect(await screen.findByRole("alert")).toHaveTextContent("nope")
    expect(screen.queryByTestId("left-this-year")).toBeNull()
  })

  it("keeps each member draft when switching members and back", async () => {
    const user = userEvent.setup()
    const as = (id: string) => (
      <TestSessionProvider activeId={id} key={id}>
        <MemoryRouter>
          <PlanYearPage />
        </MemoryRouter>
      </TestSessionProvider>
    )
    const { rerender } = render(as("m-alex"))
    await user.click(await screen.findByRole("button", { name: "Add Crown" }))
    expect(screen.getAllByTestId("treatment-row")).toHaveLength(1)
    rerender(as("m-jordan"))
    expect(screen.queryAllByTestId("treatment-row")).toHaveLength(0)
    await user.click(await screen.findByRole("button", { name: "Add Root canal, molar" }))
    rerender(as("m-alex"))
    const rows = screen.getAllByTestId("treatment-row")
    expect(rows).toHaveLength(1)
    expect(rows[0]).toHaveTextContent(/Crown|D2740/)
  })

  it("keeps the draft after unmount and remount, and after a reload from localStorage", async () => {
    const user = userEvent.setup()
    const first = renderPage()
    await user.click(await screen.findByRole("button", { name: "Add Crown" }))
    await user.click(within(screen.getByTestId("treatment-row")).getByRole("button", { name: "Urgent" }))
    first.unmount()
    const second = renderPage()
    expect(within(screen.getByTestId("treatment-row")).getByRole("button", { name: "Urgent" })).toHaveAttribute("aria-pressed", "true")
    second.unmount()
    resetDraftStoreForTests(false) // a reload: memory gone, localStorage stays
    renderPage()
    expect(screen.getByTestId("treatment-row")).toHaveTextContent(/Crown|D2740/)
  })

  it("ignores bad JSON in localStorage", () => {
    localStorage.setItem(STORAGE_KEY, "{not json")
    resetDraftStoreForTests(false)
    renderPage()
    expect(screen.getByText(/Add a treatment, or try the demo case/)).toBeInTheDocument()
  })

  it("keeps the treatments in a left column that is sticky on large screens", () => {
    renderPage()
    const col = screen.getByTestId("treatments-column")
    expect(col.className).toContain("lg:sticky")
    expect(within(col).getByRole("heading", { name: "Tap the treatments you need" })).toBeInTheDocument()
    expect(within(col).getByRole("heading", { name: "Your treatments" })).toBeInTheDocument()
  })

  it("lists the saved plans and opens one, using the live schedule numbers", async () => {
    const user = userEvent.setup()
    renderPage()
    const card = await screen.findByRole("listitem", { name: "AC S2 case" })
    expect(card).toHaveTextContent("4 treatments")
    await user.click(within(card).getByRole("button", { name: "Open AC S2 case" }))
    expect(screen.getAllByTestId("treatment-row")).toHaveLength(4)
    expect(within(card).getByText("Open now")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId("savings-total")).toHaveTextContent("$895"))
  })

  it("saves a plan with a default name, then shows unsaved changes and updates it", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "Add Crown" }))
    const name = screen.getByLabelText("Plan name") as HTMLInputElement
    expect(name.value).toMatch(/^Plan for AC, /)
    await user.clear(name)
    await user.type(name, "My crown")
    await user.click(screen.getByRole("button", { name: "Save this plan" }))
    const card = await screen.findByRole("listitem", { name: "My crown" })
    expect(within(card).getByText("Open now")).toBeInTheDocument()
    expect(calls.find((c) => c.url.endsWith("/saved-plans") && c.body)!.body!.name).toBe("My crown")
    expect(screen.queryByTestId("unsaved-changes")).toBeNull()

    await user.click(screen.getByRole("button", { name: "Add Root canal, molar" }))
    expect(screen.getByTestId("unsaved-changes")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Update saved plan" }))
    await waitFor(() => expect(screen.queryByTestId("unsaved-changes")).toBeNull())
    expect(calls.some((c) => c.url.includes("/saved-plans/sp-new") && (c.body?.items as unknown[] | undefined)?.length === 2)).toBe(true)
  })

  it("renames and deletes (after a confirm step) a saved plan", async () => {
    const user = userEvent.setup()
    renderPage()
    const card = await screen.findByRole("listitem", { name: "AC S2 case" })
    await user.click(within(card).getByRole("button", { name: "Rename AC S2 case" }))
    const input = within(card).getByLabelText("New name for AC S2 case")
    await user.clear(input)
    await user.type(input, "Renamed")
    await user.click(within(card).getByRole("button", { name: "Save name" }))
    const renamed = await screen.findByRole("listitem", { name: "Renamed" })

    await user.click(within(renamed).getByRole("button", { name: "Delete Renamed" }))
    await user.click(within(renamed).getByRole("button", { name: "Keep it" }))
    expect(screen.getByRole("listitem", { name: "Renamed" })).toBeInTheDocument()
    await user.click(within(renamed).getByRole("button", { name: "Delete Renamed" }))
    await user.click(within(renamed).getByRole("button", { name: "Yes, delete" }))
    await waitFor(() => expect(screen.queryByRole("listitem", { name: "Renamed" })).toBeNull())
    expect(screen.getByText(/You have not saved a plan yet/)).toBeInTheDocument()
  })

  it("shows a friendly message and keeps working when saved plans return 404", async () => {
    mockApi({ savedStatus: 404 })
    const user = userEvent.setup()
    renderPage()
    expect((await screen.findAllByText(/Saved plans are not available right now/)).length).toBeGreaterThan(0)
    await user.click(screen.getByRole("button", { name: "Try the demo case" }))
    await waitFor(() => expect(screen.getByTestId("savings-total")).toHaveTextContent("$895"))
  })
})
