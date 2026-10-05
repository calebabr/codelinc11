import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { TestSessionProvider } from "@/test/session"
import { resetThreads } from "@/features/assistant/threads"
import { NAV_ITEMS } from "@/components/shell/NavBar"
import ReportsPage from "./ReportsPage"
import ReportsAskPage from "./ReportsAskPage"

const ITEMS = [
  {
    id: "r1", kind: "claim", service_date: "2026-03-02", title: "Cleaning claim", provider_name: "Sample Smiles", code: "D1110",
    paid_status: "paid", data: { billed: 120, status: "paid", plan_paid: 120, you_owe: 0 },
  },
  {
    id: "r2", kind: "eob", service_date: "2026-05-10", title: "Filling EOB", provider_name: "Sample Smiles", code: "D2392",
    paid_status: "unpaid", data: { billed: 200, allowed: 150, deductible_applied: 50, plan_paid: 80, you_owe: 120 },
  },
  {
    id: "r3", kind: "claim", service_date: "2026-06-01", title: "Denied claim", provider_name: "Fictional Dental", code: "D2740",
    paid_status: "not_applicable", data: { billed: 1500, status: "denied", remark: "Denied: the crown was needed before the plan started." },
  },
]
const TOTALS = { billed: 1820, allowed: 270, plan_paid: 200, you_paid: 17.5, you_owe_open: 120 }
// The REAL server shape (backend models.ReportExplanation): lines and steps carry a `plain` sentence.
const EXPLAIN = {
  id: "r2",
  kind: "eob",
  title: "Filling EOB",
  what_it_is: "This is an explanation of benefits. It shows how your plan paid for a filling.",
  lines: [
    { label: "Billed", amount: 200, plain: "What your dentist charged for this service." },
    { label: "Allowed amount", amount: 150, plain: "The most your plan counts for this service." },
    { label: "Claim number", amount: null, plain: "CLM-1001 (made-up number)." },
  ],
  steps: [
    { key: "billed", label: "Billed", amount: 200, plain: "Your dentist charged $200." },
    { key: "allowed", label: "Allowed amount", amount: 150, plain: "Your plan allows $150 for this service." },
    { key: "deductible", label: "Deductible", amount: 50, plain: "$50 went toward your yearly deductible. You pay this part first." },
    { key: "plan_paid", label: "Plan paid", amount: 80, plain: "Your plan paid $80." },
    { key: "you_owe", label: "You owe", amount: 120, plain: "You owe $120." },
  ],
  what_to_do_next: ["Pay the $120 you owe by the date on the bill.", "Keep this notice for your records."],
  balance_billing_note: "This dentist is out of network, so they can bill you the difference.",
  lines_add_up: true,
  synthetic_notice: "These are made-up sample documents for the demo.",
  disclaimer: "This is an estimate.",
}
const EXPLAIN_DENIED = {
  id: "r3",
  kind: "claim",
  title: "Denied claim",
  what_it_is: "A claim is a request your dentist sends to your plan.",
  lines: [
    { label: "Billed", amount: 1500, plain: "What your dentist charged for this service." },
    { label: "Note on the document", amount: null, plain: "Denied: the crown was needed before the plan started." },
  ],
  steps: [{ key: "billed", label: "Billed", amount: 1500, plain: "Your dentist charged $1,500." }],
  what_to_do_next: ["Read the note on the document to see why the plan did not pay.", "Call your plan or your dentist's office."],
  balance_billing_note: null,
  lines_add_up: true,
  synthetic_notice: "These are made-up sample documents for the demo.",
  disclaimer: "This is an estimate.",
}
const SAMPLES = [
  { id: "paid-claim", title: "A paid claim", kind: "claim", text: "MOLAR MONEY SAMPLE DOCUMENT\nKind: claim" },
  { id: "oon-eob", title: "Out-of-network EOB", kind: "eob", text: "MOLAR MONEY SAMPLE DOCUMENT\nKind: eob" },
]

interface Call { url: string; method: string; body: string | null; headers: Record<string, string> }
let calls: Call[]
let listReply: (url: string) => { status: number; body: unknown }
let uploadReply: () => { status: number; body: unknown }
let explainReply: (url: string) => { status: number; body: unknown }
let items: Array<Record<string, unknown>>

beforeEach(() => {
  resetThreads()
  calls = []
  items = [...ITEMS]
  listReply = (url) => {
    const kind = new URL(url).searchParams.get("kind")
    const order = new URL(url).searchParams.get("order")
    let list = kind ? items.filter((i) => i.kind === kind) : items
    if (order === "desc") list = [...list].reverse()
    return { status: 200, body: { items: list, totals: TOTALS } }
  }
  uploadReply = () => ({ status: 200, body: { id: "r9" } })
  explainReply = (url) => ({ status: 200, body: url.includes("/r3/") ? EXPLAIN_DENIED : EXPLAIN })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? "GET"
      calls.push({ url, method, body: typeof init?.body === "string" ? init.body : null, headers: (init?.headers ?? {}) as Record<string, string> })
      const reply = (r: { status: number; body: unknown }) => new Response(JSON.stringify(r.body), { status: r.status })
      if (url.includes("/reports/samples") && method === "GET") return reply({ status: 200, body: SAMPLES })
      if (/\/reports\/samples\/[\w-]+$/.test(url) && method === "POST") return reply({ status: 200, body: { id: "r8" } })
      if (url.includes("/reports/upload")) return reply(uploadReply())
      if (url.endsWith("/explain")) return reply(explainReply(url))
      if (url.endsWith("/mark-paid")) {
        items = items.map((i) => (i.id === "r2" ? { ...i, paid_status: "paid" } : i))
        return reply({ status: 200, body: {} })
      }
      if (method === "DELETE") {
        items = items.filter((i) => !url.endsWith(`/${i.id}`))
        return reply({ status: 200, body: { ok: true } })
      }
      if (/\/members\/[\w-]+\/reports(\?|$)/.test(url)) return reply(listReply(url))
      if (url.endsWith("/chat/suggestions") || url.includes("/chat/suggestions")) return reply({ status: 200, body: { suggestions: ["SERVER CHIP"] } })
      if (url.endsWith("/chat")) {
        return new Response('event: token\ndata: {"text":"You owe $120."}\n\nevent: done\ndata: {"mode":"anthropic"}\n\n', { status: 200 })
      }
      return reply({ status: 404, body: { detail: "Not Found" } })
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())

function renderPage(activeId = "m-alex") {
  return render(
    <TestSessionProvider activeId={activeId}>
      <MemoryRouter initialEntries={["/reports"]}>
        <Routes>
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/ask" element={<ReportsAskPage />} />
        </Routes>
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

describe("Reports page", () => {
  it("is in the main nav and shows the demo notice and disclaimer", async () => {
    expect(NAV_ITEMS).toContainEqual({ to: "/reports", label: "Reports" })
    renderPage()
    expect(screen.getByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument()
    expect(screen.getByTestId("synthetic-notice")).toHaveTextContent(
      "These are made-up sample documents for the demo. Please do not upload real records.",
    )
    expect(screen.getByText(/This is an estimate\. Your actual cost depends/)).toBeInTheDocument()
    await screen.findAllByTestId("report-item")
  })

  it("shows the list and the totals exactly as the API sent them", async () => {
    renderPage()
    const cards = await screen.findAllByTestId("report-item")
    expect(cards).toHaveLength(3)
    expect(calls.find((c) => /\/members\/m-alex\/reports\?/.test(c.url))!.headers.Authorization).toBe("Bearer tok-m-jordan")
    expect(screen.getByTestId("owe-open")).toHaveTextContent("$120")
    expect(screen.getByTestId("total-billed")).toHaveTextContent("$1,820")
    expect(screen.getByTestId("total-allowed")).toHaveTextContent("$270")
    expect(screen.getByTestId("total-plan-paid")).toHaveTextContent("$200")
    expect(screen.getByTestId("total-you-paid")).toHaveTextContent("$17.50")
    expect(within(cards[0]).getByText("Cleaning claim")).toBeInTheDocument()
    expect(within(cards[0]).getByTestId("status-badge")).toHaveTextContent("Paid")
    expect(within(cards[1]).getByTestId("status-badge")).toHaveTextContent("You owe")
    expect(within(cards[2]).getByTestId("status-badge")).toHaveTextContent("Denied")
    expect(within(cards[1]).getByText("$120")).toBeInTheDocument()
  })

  it("never prints NaN when an amount is missing", async () => {
    items = [{ ...ITEMS[1], data: {} }]
    listReply = () => ({ status: 200, body: { items, totals: { billed: null, allowed: null, plan_paid: null, you_paid: null, you_owe_open: null } } })
    renderPage()
    await screen.findAllByTestId("report-item")
    expect(document.body.textContent).not.toMatch(/NaN/)
  })

  it("filters with chips and flips the date order", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.click(screen.getByRole("button", { name: "EOBs" }))
    await waitFor(() => expect(screen.getAllByTestId("report-item")).toHaveLength(1))
    expect(new URL(calls.filter((c) => c.url.includes("/reports?")).at(-1)!.url).searchParams.get("kind")).toBe("eob")
    expect(screen.getByRole("button", { name: "EOBs" })).toHaveAttribute("aria-pressed", "true")
    await user.click(screen.getByRole("button", { name: "All" }))
    await waitFor(() => expect(screen.getAllByTestId("report-item")).toHaveLength(3))
    await user.click(screen.getByRole("button", { name: "Newest first" }))
    await waitFor(() => expect(within(screen.getAllByTestId("report-item")[0]).getByText("Denied claim")).toBeInTheDocument())
    expect(new URL(calls.filter((c) => c.url.includes("/reports?")).at(-1)!.url).searchParams.get("order")).toBe("desc")
  })

  it("uses no native select", async () => {
    const { container } = renderPage()
    await screen.findAllByTestId("report-item")
    expect(container.querySelector("select")).toBeNull()
  })

  it("opens a plain-language explanation with the steps from the API", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.click(screen.getByRole("button", { name: "Explain Filling EOB" }))
    const ex = await screen.findByTestId("explanation")
    expect(within(ex).getByText(/It shows how your plan paid for a filling/)).toBeInTheDocument()
    const steps = within(ex).getAllByTestId("explain-step")
    // Each amount is shown with the server's own sentence about it.
    expect(steps.map((s) => s.textContent)).toEqual([
      "Billed$200Your dentist charged $200.",
      "Allowed amount$150Your plan allows $150 for this service.",
      "Deductible$50$50 went toward your yearly deductible. You pay this part first.",
      "Plan paid$80Your plan paid $80.",
      "You owe$120You owe $120.",
    ])
    const lines = within(ex).getByTestId("explain-lines")
    expect(lines).toHaveTextContent("Billed: What your dentist charged for this service.")
    expect(lines).toHaveTextContent("Claim number: CLM-1001 (made-up number).")
    expect(within(ex).queryByTestId("doc-remark")).not.toBeInTheDocument()
    expect(within(ex).getByTestId("balance-note")).toHaveTextContent("they can bill you the difference")
    expect(
      within(ex).getByText("Pay the $120 you owe by the date on the bill. Keep this notice for your records."),
    ).toBeInTheDocument()
    expect(calls.some((c) => c.url.endsWith("/members/m-alex/reports/r2/explain"))).toBe(true)
    await user.click(screen.getByRole("button", { name: "Hide Filling EOB" }))
    expect(screen.queryByTestId("explanation")).not.toBeInTheDocument()
  })

  it("shows the denial reason from the document, plus the steps and next steps", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.click(screen.getByRole("button", { name: "Explain Denied claim" }))
    const ex = await screen.findByTestId("explanation")
    expect(within(ex).getByTestId("doc-remark")).toHaveTextContent("Denied: the crown was needed before the plan started.")
    // The remark is not repeated in the list of lines.
    expect(within(ex).getByTestId("explain-lines")).not.toHaveTextContent("crown was needed")
    expect(within(ex).getByTestId("step-plain")).toHaveTextContent("Your dentist charged $1,500.")
    expect(
      within(ex).getByText("Read the note on the document to see why the plan did not pay. Call your plan or your dentist's office."),
    ).toBeInTheDocument()
  })

  it("adds a sample with one tap and reloads the list", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    const before = calls.filter((c) => /\/reports\?/.test(c.url)).length
    await user.click(await screen.findByRole("button", { name: "Add sample: Out-of-network EOB" }))
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/members/m-alex/reports/samples/oon-eob"))).toBe(true))
    await waitFor(() => expect(calls.filter((c) => /\/reports\?/.test(c.url)).length).toBeGreaterThan(before))
    expect(await screen.findByText("Added: Out-of-network EOB")).toBeInTheDocument()
  })

  it("uploads pasted text and shows the 422 message plainly", async () => {
    const user = userEvent.setup()
    uploadReply = () => ({ status: 422, body: { detail: "Demo accepts the sample documents only." } })
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.type(screen.getByLabelText("Paste a sample document"), "hello there")
    await user.click(screen.getByRole("button", { name: "Add this document" }))
    expect(await screen.findByText("Demo accepts the sample documents only.")).toBeInTheDocument()
    const up = calls.find((c) => c.url.includes("/reports/upload"))!
    expect(up.method).toBe("POST")
    expect(up.body).toBe("hello there")
    expect(up.headers["Content-Type"]).toBe("text/plain")
    expect(new URL(up.url).searchParams.get("filename")).toBe("pasted.txt")
  })

  it("uploads text that the server accepts", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.type(screen.getByLabelText("Paste a sample document"), "MOLAR MONEY SAMPLE DOCUMENT")
    await user.click(screen.getByRole("button", { name: "Add this document" }))
    expect(await screen.findByText("Added your document.")).toBeInTheDocument()
  })

  it("marks an unpaid item paid and refreshes", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.click(screen.getByRole("button", { name: "Mark Filling EOB paid" }))
    await waitFor(() => expect(calls.some((c) => c.method === "POST" && c.url.endsWith("/members/m-alex/reports/r2/mark-paid"))).toBe(true))
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark Filling EOB paid" })).not.toBeInTheDocument())
  })

  it("asks before deleting, and can be cancelled", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.click(screen.getByRole("button", { name: "Delete Denied claim" }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(calls.some((c) => c.method === "DELETE")).toBe(false)
    await user.click(screen.getByRole("button", { name: "Delete Denied claim" }))
    await user.click(screen.getByRole("button", { name: "Yes, delete Denied claim" }))
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/members/m-alex/reports/r3"))).toBe(true))
    await waitFor(() => expect(screen.getAllByTestId("report-item")).toHaveLength(2))
  })

  it("shows a friendly empty state", async () => {
    listReply = () => ({ status: 200, body: { items: [], totals: { billed: 0, allowed: 0, plan_paid: 0, you_paid: 0, you_owe_open: 0 } } })
    renderPage()
    expect(await screen.findByTestId("empty")).toHaveTextContent("No documents yet for Mary")
  })

  it("shows an error with a retry", async () => {
    const user = userEvent.setup()
    listReply = () => ({ status: 500, body: { detail: "Server broke." } })
    renderPage()
    expect(await screen.findByText("Server broke.")).toBeInTheDocument()
    listReply = () => ({ status: 200, body: { items, totals: TOTALS } })
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findAllByTestId("report-item")).toHaveLength(3)
  })

  it("says the demo family expired on a 410 and does not claim reports are missing", async () => {
    listReply = () => ({ status: 410, body: { detail: "That demo family has expired or no longer exists. Start a new one." } })
    renderPage()
    expect(await screen.findByText("Your demo family has expired. Start a new one.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Start a new demo family" })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/not available on the server/)
  })

  it("treats a missing member (an evicted family) as expired", async () => {
    listReply = () => ({ status: 404, body: { detail: "Not found: member m-alex.f00ba4" } })
    renderPage()
    expect(await screen.findByText("Your demo family has expired. Start a new one.")).toBeInTheDocument()
  })

  it("keeps a short 'not available' message for a real 404 and shows no retry button", async () => {
    listReply = () => ({ status: 404, body: { detail: "Not Found" } })
    renderPage()
    expect(await screen.findByText("This part is not available on the server right now.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument()
  })

  it("sends the person back to sign in, calmly, after a 401", async () => {
    listReply = () => ({ status: 401, body: { detail: "Your session is not valid. Please sign in again." } })
    renderPage()
    expect(await screen.findByText(/Your sign-in has timed out/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/server returned an error/)
  })

  it("explains when this person's documents are not visible", async () => {
    listReply = () => ({ status: 403, body: { detail: "No access." } })
    renderPage("m-maya")
    expect(await screen.findByTestId("no-access")).toHaveTextContent("You can't see Tad's documents")
    expect(screen.queryByTestId("totals")).not.toBeInTheDocument()
  })

  it("links to the ask page, which sends scope reports and shows its own chips", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId("report-item")
    await user.click(screen.getByRole("link", { name: "Ask the assistant about my reports" }))
    expect(await screen.findByRole("heading", { level: 1, name: "Ask about my reports" })).toBeInTheDocument()
    expect(screen.getByTestId("synthetic-notice")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to Reports" })).toHaveAttribute("href", "/reports")
    for (const q of ["What do I owe right now?", "Explain my last EOB", "Why was this claim denied?", "Which visits are still unpaid?"])
      expect(screen.getByRole("button", { name: q })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "SERVER CHIP" })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "What do I owe right now?" }))
    expect(await screen.findByText("You owe $120.")).toBeInTheDocument()
    const chat = calls.find((c) => c.url.endsWith("/chat"))!
    const body = JSON.parse(chat.body!)
    expect(body.scope).toBe("reports")
    expect(body.member_id).toBe("m-alex")
    expect(body.messages).toEqual([{ role: "user", content: "What do I owe right now?" }])
  })
})
