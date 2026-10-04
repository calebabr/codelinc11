import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { ALL_MEMBERS, TestSessionProvider } from "@/test/session"
import { NAV_ITEMS } from "@/components/shell/NavBar"
import ProvidersPage from "./ProvidersPage"

const PROCS = [
  { code: "D2740", name: "Crown", category: "major", description: "", synonyms: [], fee_p50: 1200, fee_p80: 1500 },
  { code: "D1110", name: "Cleaning", category: "preventive", description: "", synonyms: [], fee_p50: 120, fee_p80: 160 },
].map((procedure) => ({ procedure, score: 1 }))

const base = { dentist_name: "Dr. Pat Example", specialty: "general", address: "1 Fake St", state: "AL", zip: "36830", phone: "(334) 555-0101", languages: ["English", "Spanish"] }
const IN = { ...base, id: "p1", practice_name: "Sample Smiles", city: "Auburn", distance_mi: 3.2, accepting_new: true, in_network: true }
const OUT = { ...base, id: "p2", practice_name: "Fictional Family Dental", city: "Opelika", distance_mi: 8.5, accepting_new: false, in_network: false }

interface Call { url: string; method: string; body: Record<string, unknown> | null }
let calls: Call[]
let providerReply: () => { status: number; body: unknown }
let patchReply: (body: Record<string, unknown>) => { status: number; body: unknown }

const members = ALL_MEMBERS.map((m) => (m.id === "m-jordan" ? { ...m, zip: "36830" } : m))

beforeEach(() => {
  localStorage.clear()
  calls = []
  providerReply = () => ({ status: 200, body: [IN, OUT] })
  patchReply = (body) => ({ status: 200, body: { ...members[0], ...body } })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null
      calls.push({ url, method, body })
      const reply = (r: { status: number; body: unknown }) => ({ ok: r.status < 400, status: r.status, json: async () => r.body })
      if (url.includes("/procedures")) return reply({ status: 200, body: PROCS })
      if (url.includes("/providers")) return reply(providerReply())
      if (url.includes("/profile") && method === "PATCH") return reply(patchReply(body!))
      return reply({ status: 404, body: { detail: "Not Found" } })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

const providerCalls = () => calls.filter((c) => c.url.includes("/providers"))
const lastQuery = () => new URL(providerCalls().at(-1)!.url).searchParams

function renderPage(withProfileZip = true) {
  return render(
    <TestSessionProvider members={withProfileZip ? members : ALL_MEMBERS}>
      <MemoryRouter>
        <ProvidersPage />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

describe("Find providers page", () => {
  it("is in the main nav", () => {
    expect(NAV_ITEMS).toContainEqual({ to: "/providers", label: "Providers" })
  })

  it("prefills the profile ZIP, searches, and renders result cards", async () => {
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Find a dentist near you" })).toBeInTheDocument()
    expect(screen.getByLabelText("ZIP code")).toHaveValue("36830")
    const cards = await screen.findAllByTestId("provider-card")
    expect(cards).toHaveLength(2)
    expect(within(cards[0]).getByText("Sample Smiles")).toBeInTheDocument()
    expect(within(cards[0]).getByText("Auburn, AL · 3.2 mi")).toBeInTheDocument()
    expect(within(cards[0]).getByText("In network")).toBeInTheDocument()
    expect(within(cards[0]).getByText("Accepting new patients")).toBeInTheDocument()
    expect(within(cards[0]).getByText("Languages: English, Spanish")).toBeInTheDocument()
    expect(within(cards[0]).getByRole("link", { name: /Call Sample Smiles/ })).toHaveAttribute("href", "tel:3345550101")
    expect(within(cards[1]).getByText("Out of network")).toBeInTheDocument()
    expect(within(cards[1]).getByText("Not accepting")).toBeInTheDocument()
    expect(screen.getByText("Demo directory: the practices are fictional.")).toBeInTheDocument()
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
    expect(lastQuery().get("zip")).toBe("36830")
    expect(lastQuery().get("member_id")).toBe("m-jordan")
  })

  it("sends filters in the query string", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("provider-card")
    await user.click(screen.getByRole("button", { name: "50 miles" }))
    await user.click(screen.getByRole("button", { name: "In network" }))
    await user.click(screen.getByRole("button", { name: "Braces" }))
    await user.click(screen.getByRole("switch", { name: "Accepting new patients" }))
    await waitFor(() => {
      const q = lastQuery()
      expect(q.get("radius_mi")).toBe("50")
      expect(q.get("network")).toBe("in")
      expect(q.get("specialty")).toBe("orthodontics")
      expect(q.get("accepting")).toBe("1")
    })
    // Quick taps are batched by the 300 ms pause, so there are fewer requests than taps.
    expect(providerCalls().length).toBeLessThan(5)
  })

  it("remembers the last ZIP for the family", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("provider-card")
    const input = screen.getByLabelText("ZIP code")
    await user.clear(input)
    await user.type(input, "30301{Enter}")
    await waitFor(() => expect(lastQuery().get("zip")).toBe("30301"))
    expect(localStorage.getItem("dental.providersZip.v1.hh-rivera")).toBe("30301")
  })

  it("starts from the remembered ZIP when there is one", async () => {
    localStorage.setItem("dental.providersZip.v1.hh-rivera", "46801")
    renderPage()
    expect(screen.getByLabelText("ZIP code")).toHaveValue("46801")
    await screen.findAllByTestId("provider-card")
    expect(lastQuery().get("zip")).toBe("46801")
  })

  it("shows the server's 422 message inline", async () => {
    providerReply = () => ({ status: 422, body: { detail: "We don't have that ZIP code yet." } })
    renderPage()
    expect(await screen.findByRole("alert")).toHaveTextContent("We don't have that ZIP code yet.")
    expect(screen.queryByTestId("provider-card")).not.toBeInTheDocument()
  })

  it("shows a plain message on a 404", async () => {
    providerReply = () => ({ status: 404, body: { detail: "Not Found" } })
    renderPage()
    expect(await screen.findByText("Finding dentists is not available on the server yet.")).toBeInTheDocument()
  })

  it("shows the empty state with the radius", async () => {
    providerReply = () => ({ status: 200, body: [] })
    renderPage()
    expect(await screen.findByText("No dentists within 25 miles. Try a wider radius.")).toBeInTheDocument()
  })

  it("asks for a ZIP when none is known", async () => {
    const user = userEvent.setup()
    renderPage(false)
    expect(screen.getByText(/Enter your ZIP code and tap Search/)).toBeInTheDocument()
    expect(providerCalls()).toHaveLength(0)
    await user.type(screen.getByLabelText("ZIP code"), "123")
    await user.click(screen.getByRole("button", { name: "Search" }))
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a 5-digit ZIP code")
    expect(providerCalls()).toHaveLength(0)
  })

  it("shows what you would pay for a chosen procedure", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("provider-card")
    providerReply = () => ({
      status: 200,
      body: [
        { ...IN, estimate: { you_pay: 800, plan_pays: 400, in_network: true, balance_bill: 0 } },
        { ...OUT, estimate: { you_pay: 925, plan_pays: 575, in_network: false, balance_bill: 300 } },
      ],
    })
    await user.click(await screen.findByRole("button", { name: "Price Crown" }))
    const ests = await screen.findAllByTestId("provider-estimate")
    expect(lastQuery().get("code")).toBe("D2740")
    expect(ests[0]).toHaveTextContent("You would pay $800 here")
    expect(ests[1]).toHaveTextContent("You would pay $925 here")
    expect(ests[1]).toHaveTextContent("Plan pays $575")
    expect(ests[1]).toHaveTextContent("You may also owe $300 the dentist can bill beyond the plan allowance")
  })

  it("sets and removes my dentist", async () => {
    const user = userEvent.setup()
    renderPage()
    const first = (await screen.findAllByTestId("provider-card"))[0]
    await user.click(within(first).getByRole("button", { name: /Set Sample Smiles as my dentist/ }))
    const patch = calls.find((c) => c.method === "PATCH")!
    expect(patch.url).toContain("/members/m-jordan/profile")
    expect(patch.body).toEqual({ primary_dentist_id: "p1" })
    const mine = (await screen.findAllByTestId("provider-card"))[0]
    expect(await within(mine).findByText("Your dentist")).toBeInTheDocument()
    await user.click(within(mine).getByRole("button", { name: /Remove Sample Smiles/ }))
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH").at(-1)!.body).toEqual({ primary_dentist_id: null }))
    await waitFor(() => expect(screen.queryByText("Your dentist")).not.toBeInTheDocument())
  })

  it("explains a 403 on the shared demo family", async () => {
    patchReply = () => ({ status: 403, body: { detail: "forbidden" } })
    const user = userEvent.setup()
    renderPage()
    const first = (await screen.findAllByTestId("provider-card"))[0]
    await user.click(within(first).getByRole("button", { name: /Set Sample Smiles/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("The shared demo family can't be edited. Start your own demo family.")
    expect(screen.queryByText("Your dentist")).not.toBeInTheDocument()
  })

  it("badges say the network in words, not colour alone", async () => {
    renderPage()
    const cards = await screen.findAllByTestId("provider-card")
    expect(cards[0]).toHaveTextContent("In network")
    expect(cards[1]).toHaveTextContent("Out of network")
    expect(screen.getByText(/In network means a lower price\. Out of network can cost more/)).toBeInTheDocument()
  })
})
