import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { TestSessionProvider } from "@/test/session"
import { QuoteView } from "./QuoteView"

const SAMPLES = [
  { id: "in", title: "Sample Smiles quote", text: "Sample Smiles\nD1110 $120" },
  { id: "out", title: "Fictional Dental quote", text: "Fictional Dental\nD1110 $160" },
]
const ITEM = {
  id: "q1", code: "D1110", name: "Cleaning", tooth: null, quoted_fee: 120, typical_fee: 120, urgency: "flexible", after: null,
  phase: null, matched: true, confidence: 1, source_line: "",
}

let match: unknown
let parseBodies: { text: string }[]

beforeEach(() => {
  parseBodies = []
  match = {
    matched: true, provider_id: "p1", name: "Sample Smiles", dentist: "Dr. Pat Example", address: "1 Fake St, Auburn, AL 36830",
    in_network: true, network_note: "In your plan's network.", source: "insurer directory",
  }
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })
      if (url.endsWith("/treatment-plan/samples")) return ok(SAMPLES)
      if (url.endsWith("/treatment-plan/parse")) {
        parseBodies.push(JSON.parse(String(init!.body)))
        return ok({ items: [ITEM], unmatched_lines: [], notes: [], mode: "rules", provider_match: match })
      }
      if (url.includes("/members/")) return ok({ usage: { plan_year: 2026, max_used: 0, deductible_met: 0, visits: 0, cleanings_used: 0 } })
      if (url.endsWith("/savings-tips")) return ok({ tips: [] })
      return new Response("{}", { status: 404 })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

function renderQuote() {
  return render(
    <TestSessionProvider>
      <MemoryRouter>
        <QuoteView memberId="m-jordan" planId="preferred" />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

describe("Quote: the dentist behind the quote", () => {
  it("offers sample quotes and reads one with a single tap", async () => {
    const user = userEvent.setup()
    renderQuote()
    await user.click(await screen.findByRole("button", { name: "Try a sample quote: Sample Smiles quote" }))
    await waitFor(() => expect(parseBodies).toEqual([{ plan_id: "preferred", text: "Sample Smiles\nD1110 $120" }]))
    expect(await screen.findByTestId("provider-match")).toBeInTheDocument()
  })

  it("shows the matched practice with an In network badge and the source", async () => {
    const user = userEvent.setup()
    renderQuote()
    await user.click(await screen.findByRole("button", { name: /Try a sample quote: Sample Smiles/ }))
    const card = await screen.findByTestId("provider-match")
    expect(card).toHaveTextContent("This quote is from: Sample Smiles, Dr. Pat Example, 1 Fake St, Auburn, AL 36830")
    expect(card).toHaveTextContent("In network")
    expect(card).not.toHaveTextContent("Out of network")
    expect(card).toHaveTextContent("Source: insurer directory")
  })

  it("shows an Out of network badge when the practice is out of network", async () => {
    const user = userEvent.setup()
    match = { matched: true, name: "Fictional Dental", dentist: "Dr. Sam Example", address: "2 Fake Rd", in_network: false, source: "insurer directory" }
    renderQuote()
    await user.click(await screen.findByRole("button", { name: /Try a sample quote: Fictional Dental/ }))
    expect(await screen.findByTestId("provider-match")).toHaveTextContent("Out of network")
  })

  it("says so and links to Find Providers when the dentist is not in the directory", async () => {
    const user = userEvent.setup()
    match = { matched: false, network_note: "Priced as out of network.", source: "insurer directory" }
    renderQuote()
    await user.click(await screen.findByRole("button", { name: /Try a sample quote: Fictional Dental/ }))
    const card = await screen.findByTestId("provider-match-none")
    expect(card).toHaveTextContent("We could not find this dentist in your plan's directory, so this is priced as out of network.")
    expect(screen.getByRole("link", { name: "Find a dentist in your network" })).toHaveAttribute("href", "/providers")
  })

  it("shows no dentist card when an older server sends no provider_match", async () => {
    const user = userEvent.setup()
    match = undefined
    renderQuote()
    await user.click(await screen.findByRole("button", { name: /Try a sample quote: Sample Smiles/ }))
    await screen.findByTestId("match-count")
    expect(screen.queryByTestId("provider-match")).not.toBeInTheDocument()
    expect(screen.queryByTestId("provider-match-none")).not.toBeInTheDocument()
  })
})
