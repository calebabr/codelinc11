import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { TIER, TestSessionProvider } from "@/test/session"
import PlansPage from "./PlansPage"

const base = { deductible_waived_for: ["preventive"], frequency: { D1110: 2, D0120: 2 }, plan_year_start_month: 1, alternate_benefit: true }
const PLANS = [
  { ...base, id: "basic", name: "Basic", description: "Lowest premium.", monthly_premium: 28, deductible: 100, annual_max: 1000, coinsurance: { preventive: 1, basic: 0.5, major: 0 }, orthodontia_child: 0 },
  { ...base, id: "preferred", name: "Preferred", description: "Typical plan.", monthly_premium: 44, deductible: 50, annual_max: 1500, coinsurance: { preventive: 1, basic: 0.8, major: 0.5 }, orthodontia_child: 0.5 },
  { ...base, id: "premium", name: "Premium", description: "Most coverage.", monthly_premium: 61, deductible: 50, annual_max: 2500, coinsurance: { preventive: 1, basic: 0.9, major: 0.7 }, orthodontia_child: 0.6 },
]

let putResult: { status: number; body: unknown } = { status: 200, body: null }
let puts: { url: string; body: unknown; auth: string | null }[] = []

function stubFetch() {
  puts = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        const headers = (init.headers ?? {}) as Record<string, string>
        puts.push({ url: String(input), body: JSON.parse(String(init.body)), auth: headers.Authorization ?? null })
        const b = putResult.body ?? {
          id: "hh-rivera",
          name: "Lincoln household",
          plan_tier: { ...TIER, id: "premium", name: "Premium", annual_max: 2500 },
          members: [],
        }
        return { ok: putResult.status < 400, status: putResult.status, json: async () => b }
      }
      if (String(input).endsWith("/simulate")) return { ok: false, status: 404, json: async () => ({ detail: "Not Found" }) }
      if (String(input).endsWith("/procedures")) return { ok: true, status: 200, json: async () => [] }
      return { ok: true, status: 200, json: async () => PLANS }
    }),
  )
}

function renderPage(signedInId = "m-jordan") {
  return render(
    <TestSessionProvider signedInId={signedInId}>
      <MemoryRouter>
        <PlansPage />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

beforeEach(() => {
  putResult = { status: 200, body: null }
  stubFetch()
})
afterEach(() => vi.restoreAllMocks())

describe("Plans page", () => {
  it("shows the three tiers with the D6 numbers and tags the household tier", async () => {
    const { container } = renderPage()
    const pref = within(await screen.findByTestId("tier-preferred"))
    expect(pref.getByText("$44")).toBeInTheDocument()
    expect(pref.getByText("$1,500")).toBeInTheDocument()
    expect(pref.getByText("$50")).toBeInTheDocument()
    expect(pref.getByText("Your plan")).toBeInTheDocument()
    expect(within(screen.getByTestId("tier-basic")).queryByText("Your plan")).toBeNull()
    expect(within(screen.getByTestId("tier-premium")).getByText("$2,500")).toBeInTheDocument()
    expect(screen.getByTestId("tier-preferred")).toHaveAttribute("aria-pressed", "true")

    const bars = screen.getAllByRole("progressbar")
    expect(bars.map((b) => b.getAttribute("aria-valuenow"))).toEqual(["100", "80", "50", "50"])
    expect(screen.getByTestId("plan-summary")).toHaveTextContent("Plan pays 80% of fillings after a $50 deductible, up to $1,500 a year.")
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
    expect(container.querySelector("select")).toBeNull()
  })

  it("changes the bars, summary and highlighted table column when another tier is selected", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByTestId("tier-basic"))
    expect(screen.getByTestId("tier-basic")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByTestId("tier-preferred")).toHaveAttribute("aria-pressed", "false")
    expect(screen.getAllByRole("progressbar").map((b) => b.getAttribute("aria-valuenow"))).toEqual(["100", "50", "0", "0"])
    expect(screen.getByTestId("plan-summary")).toHaveTextContent("Major care (crowns) is not covered.")
    const table = within(screen.getByTestId("compare-table"))
    expect(table.getByRole("columnheader", { name: "Basic" })).toHaveAttribute("data-selected", "true")
    expect(table.getByRole("columnheader", { name: "Preferred" })).toHaveAttribute("data-selected", "false")
    expect(table.getByText("$1,000")).toBeInTheDocument()
  })

  it("shows an error with retry when the server is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline") }))
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent(/can't reach the server/i)
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
  })

  describe("switching the household plan", () => {
    it("shows no button while the household's own tier is selected", async () => {
      renderPage()
      await screen.findByTestId("tier-preferred")
      expect(screen.queryByRole("button", { name: "Switch to this plan" })).toBeNull()
      expect(screen.queryByRole("button", { name: /Back to Preferred/ })).toBeNull()
    })

    it("lets the primary switch after a confirm step, then moves the Your plan tag", async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByTestId("tier-premium"))
      await user.click(screen.getByRole("button", { name: "Switch to this plan" }))
      const panel = within(screen.getByTestId("confirm-switch"))
      expect(panel.getByTestId("change-Yearly maximum")).toHaveTextContent("$1,500 to $2,500")
      expect(panel.getByTestId("change-Deductible")).toHaveTextContent("$50 to $50")
      expect(panel.getByTestId("change-Plan pays for major care")).toHaveTextContent("50% to 70%")
      expect(panel.getByTestId("change-Monthly price")).toHaveTextContent("$44 to $61")
      expect(panel.getByText(/usage so far .* stays/i)).toBeInTheDocument()
      expect(puts).toHaveLength(0)

      await user.click(panel.getByRole("button", { name: "Yes, switch to Premium" }))
      expect(await screen.findByTestId("switch-done")).toHaveTextContent("now on the Premium plan")
      expect(puts).toHaveLength(1)
      expect(puts[0].url).toMatch(/\/households\/hh-rivera\/plan$/)
      expect(puts[0].body).toEqual({ tier_id: "premium" })
      expect(puts[0].auth).toBe("Bearer tok-m-jordan")
      expect(within(screen.getByTestId("tier-premium")).getByText("Your plan")).toBeInTheDocument()
      expect(within(screen.getByTestId("tier-preferred")).queryByText("Your plan")).toBeNull()
      expect(screen.queryByTestId("confirm-switch")).toBeNull()
      expect(screen.getByRole("button", { name: "Back to Preferred (demo plan)" })).toBeInTheDocument()
    })

    it("cancel closes the confirm panel without calling the server", async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByTestId("tier-basic"))
      await user.click(screen.getByRole("button", { name: "Switch to this plan" }))
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      expect(screen.queryByTestId("confirm-switch")).toBeNull()
      expect(puts).toHaveLength(0)
      expect(within(screen.getByTestId("tier-preferred")).getByText("Your plan")).toBeInTheDocument()
    })

    it("offers no switch button to a non-primary member, only a note", async () => {
      const user = userEvent.setup()
      renderPage("m-alex")
      await user.click(await screen.findByTestId("tier-premium"))
      expect(screen.queryByRole("button", { name: "Switch to this plan" })).toBeNull()
      expect(screen.getByText("Only Abraham can change the family plan.")).toBeInTheDocument()
    })

    it("explains clearly when the server does not have the plan route yet (404)", async () => {
      const user = userEvent.setup()
      putResult = { status: 404, body: { detail: "Not Found" } }
      renderPage()
      await user.click(await screen.findByTestId("tier-premium"))
      await user.click(screen.getByRole("button", { name: "Switch to this plan" }))
      await user.click(screen.getByRole("button", { name: "Yes, switch to Premium" }))
      expect(await screen.findByRole("alert")).toHaveTextContent(/not available on the server yet/i)
      expect(within(screen.getByTestId("tier-preferred")).getByText("Your plan")).toBeInTheDocument()
      expect(screen.getByTestId("confirm-switch")).toBeInTheDocument()
    })

    it("Back to Preferred switches back after a confirm", async () => {
      const user = userEvent.setup()
      renderPage()
      await user.click(await screen.findByTestId("tier-premium"))
      await user.click(screen.getByRole("button", { name: "Switch to this plan" }))
      await user.click(screen.getByRole("button", { name: "Yes, switch to Premium" }))
      await screen.findByTestId("switch-done")

      putResult = { status: 200, body: { id: "hh-rivera", name: "Lincoln household", plan_tier: TIER, members: [] } }
      await user.click(screen.getByRole("button", { name: "Back to Preferred (demo plan)" }))
      await user.click(screen.getByRole("button", { name: "Yes, switch to Preferred" }))
      expect(await screen.findByTestId("switch-done")).toHaveTextContent("now on the Preferred plan")
      expect(puts.map((p) => p.body)).toEqual([{ tier_id: "premium" }, { tier_id: "preferred" }])
      expect(within(screen.getByTestId("tier-preferred")).getByText("Your plan")).toBeInTheDocument()
      expect(screen.queryByRole("button", { name: /Back to Preferred/ })).toBeNull()
    })
  })
})
