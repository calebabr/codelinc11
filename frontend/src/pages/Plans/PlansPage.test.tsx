import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SessionProvider } from "@/state/SessionContext"
import PlansPage from "./PlansPage"

const base = { deductible_waived_for: ["preventive"], frequency: { D1110: 2, D0120: 2 }, plan_year_start_month: 1, alternate_benefit: true }
const PLANS = [
  { ...base, id: "basic", name: "Basic", description: "Lowest premium.", monthly_premium: 28, deductible: 100, annual_max: 1000, coinsurance: { preventive: 1, basic: 0.5, major: 0 }, orthodontia_child: 0 },
  { ...base, id: "preferred", name: "Preferred", description: "Typical plan.", monthly_premium: 44, deductible: 50, annual_max: 1500, coinsurance: { preventive: 1, basic: 0.8, major: 0.5 }, orthodontia_child: 0.5 },
  { ...base, id: "premium", name: "Premium", description: "Most coverage.", monthly_premium: 61, deductible: 50, annual_max: 2500, coinsurance: { preventive: 1, basic: 0.9, major: 0.7 }, orthodontia_child: 0.6 },
]

function renderPage() {
  return render(
    <SessionProvider>
      <PlansPage />
    </SessionProvider>,
  )
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => PLANS })))
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
})
