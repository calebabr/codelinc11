import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { TestSessionProvider } from "@/test/session"
import HomePage from "./HomePage"

function benefits(used: number, remaining: number, dedMet: number, cleanings: number, reminder: string | null) {
  return {
    plan_name: "Preferred",
    annual_max: 1500,
    max_used: used,
    max_remaining: remaining,
    deductible: 50,
    deductible_met: dedMet,
    deductible_remaining: 50 - dedMet,
    frequencies: [{ code: "D1110", name: "Cleaning", used: cleanings, limit: 2, remaining: 2 - cleanings }],
    unused_preventive_value: 0,
    months_left: 2,
    reminder,
  }
}
function overview(id: string) {
  const alex = id === "m-alex"
  return {
    member: { id },
    plan_tier: { id: "preferred", name: "Preferred" },
    usage: { plan_year: 2026, max_used: alex ? 1100 : 200, deductible_met: alex ? 50 : 0, visits: 1, cleanings_used: alex ? 1 : 0 },
    benefits: alex ? benefits(1100, 400, 50, 1, "Only $400 left. Book soon.") : benefits(200, 1300, 0, 0, null),
    reminder: alex ? "Only $400 left. Book soon." : null,
    as_of: "2026-11-01",
  }
}
const PROCS = [
  { procedure: { code: "D1110", name: "Cleaning (adult)", category: "preventive", description: "", synonyms: [], fee_p50: 120, fee_p80: 160 }, score: 1 },
]

let calls: { url: string; auth: string | null; body: Record<string, unknown> | null }[]
let saved = false
let routesLive = true
let visitCovered = true
function mockApi(fail = false, emptySchedule = false) {
  calls = []
  saved = false
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url, auth: headers.Authorization ?? null, body: init?.body ? JSON.parse(String(init.body)) : null })
      const ok = (d: unknown) => ({ ok: true, status: 200, json: async () => d })
      if (fail) throw new Error("offline")
      const m = url.match(/\/members\/([^/]+)\/(overview|schedule)/)
      if (m?.[2] === "overview") return ok(saved ? { ...overview(m[1]), benefits: benefits(1220, 280, 50, 2, "Only $280 left.") } : overview(m[1]))
      if (m?.[2] === "schedule")
        return ok(
          emptySchedule
            ? []
            : [
                { id: 1, member_id: m[1], member_name: "X", kind: "appointment", due_date: "2026-11-20", title: `Checkup for ${m[1]}`, note: null },
                { id: 2, member_id: m[1], member_name: "X", kind: "reminder", due_date: "2026-12-01", title: "Use your benefits", note: "Before they reset" },
              ],
        )
      if (url.endsWith("/procedures")) return ok(PROCS)
      if (url.endsWith("/visits")) {
        if (!routesLive) return { ok: false, status: 404, json: async () => ({}) }
        saved = true
        return {
          ok: true,
          status: 201,
          json: async () => ({
            // Same shape as the real API: flat, with in_network as a boolean
            estimate: { code: "D1110", name: "Cleaning (adult)", in_network: true, covered: visitCovered, deductible_applied: 0, plan_pays: visitCovered ? 120 : 0, you_pay: visitCovered ? 0 : 120, max_used_after: 1220 },
            usage: { max_used: 1220, deductible_met: 50, history: ["D1110"] },
            benefits: benefits(1220, 280, 50, 2, "Only $280 left."),
          }),
        }
      }
      if (url.endsWith("/demo/reset")) {
        if (!routesLive) return { ok: false, status: 404, json: async () => ({}) }
        saved = false
        return ok({ ok: true })
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }),
  )
}

function renderPage(id = "m-alex") {
  return render(
    <TestSessionProvider activeId={id}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

beforeEach(() => {
  routesLive = true
  visitCovered = true
  mockApi()
})
afterEach(() => vi.restoreAllMocks())

describe("Home page", () => {
  it("shows Alex's numbers, the reminder and upcoming events", async () => {
    const { container } = renderPage("m-alex")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Welcome back, Alex")
    expect(await within(await screen.findByTestId("card-max")).findByText("$400")).toBeInTheDocument()
    expect(screen.getByTestId("card-max")).toHaveTextContent("left of $1,500")
    expect(screen.getByTestId("card-deductible")).toHaveTextContent("Met")
    expect(screen.getByTestId("card-cleanings")).toHaveTextContent("1 of 2")
    expect(screen.getByText("Only $400 left. Book soon.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Add reminders to my calendar/ })).toHaveAttribute(
      "href",
      expect.stringContaining("max_remaining=400"),
    )
    expect(screen.getAllByTestId("upcoming-item")).toHaveLength(2)
    expect(screen.getByText("Checkup for m-alex")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Plan My Year/ })).toHaveAttribute("href", "/plan-year")
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
    expect(container.querySelector("select")).toBeNull()
    expect(calls.find((c) => c.url.includes("/overview"))!.auth).toBe("Bearer tok-m-jordan")
    expect(calls.some((c) => c.url.endsWith("/auth/demo-login"))).toBe(false)
  })

  it("shows different numbers for Jordan and no reminder", async () => {
    renderPage("m-jordan")
    expect(await within(await screen.findByTestId("card-max")).findByText("$1,300")).toBeInTheDocument()
    expect(screen.getByTestId("card-deductible")).toHaveTextContent("$50")
    expect(screen.getByTestId("card-cleanings")).toHaveTextContent("0 of 2")
    expect(screen.queryByLabelText("Benefits reminder")).toBeNull()
  })

  it("saves a visit on the server, shows You pay from the response and reloads the overview", async () => {
    const user = userEvent.setup()
    renderPage("m-alex")
    await user.click(await screen.findByRole("button", { name: "Log Cleaning (adult)" }))
    await waitFor(() => expect(screen.getByTestId("visit-result")).toHaveTextContent("You pay $0"))
    await waitFor(() => expect(screen.getByTestId("card-max")).toHaveTextContent("$280"))
    expect(screen.getByTestId("card-cleanings")).toHaveTextContent("2 of 2")
    const post = calls.find((c) => c.url.endsWith("/members/m-alex/visits"))!
    expect(post.body).toEqual({ code: "D1110", in_network: true })
    expect(post.auth).toBe("Bearer tok-m-jordan")
    expect(calls.some((c) => c.url.endsWith("/estimate"))).toBe(false)
    expect(calls.filter((c) => c.url.includes("/overview")).length).toBeGreaterThanOrEqual(2)
  })

  it("shows the real amounts for a visit over the frequency limit (no $NaN)", async () => {
    visitCovered = false
    const user = userEvent.setup()
    renderPage("m-alex")
    await user.click(await screen.findByRole("button", { name: "Log Cleaning (adult)" }))
    const result = await screen.findByTestId("visit-result")
    await waitFor(() => expect(result).toHaveTextContent("You pay $120"))
    expect(result).toHaveTextContent("The plan pays $0")
    expect(result).toHaveTextContent("Not covered because of a frequency limit.")
    expect(result).not.toHaveTextContent("NaN")
  })

  it("shows a plain message when the visit route is not available yet", async () => {
    routesLive = false
    const user = userEvent.setup()
    renderPage("m-alex")
    await user.click(await screen.findByRole("button", { name: "Log Cleaning (adult)" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/not available on the server yet/i)
  })

  it("lets the primary reset demo data after a confirm, and hides the button from others", async () => {
    const user = userEvent.setup()
    renderPage("m-alex")
    await user.click(await screen.findByRole("button", { name: "Reset demo data" }))
    expect(calls.some((c) => c.url.endsWith("/demo/reset"))).toBe(false)
    await user.click(screen.getByRole("button", { name: "Yes, reset" }))
    await waitFor(() => expect(calls.find((c) => c.url.endsWith("/demo/reset"))!.auth).toBe("Bearer tok-m-jordan"))
    expect(await screen.findByText("Demo data was reset.")).toBeInTheDocument()
  })

  it("shows an empty state when nothing is scheduled", async () => {
    mockApi(false, true)
    renderPage()
    expect(await screen.findByText(/Nothing is scheduled for Alex yet/)).toBeInTheDocument()
  })

  it("shows an error with retry when the server is down", async () => {
    mockApi(true)
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i)
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })
})
