import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TestSessionProvider } from "@/test/session"
import { resetThreads } from "@/features/assistant/threads"
import { parseSse } from "@/lib/api/assistant"
import AssistantPage from "./AssistantPage"

const SUGG: Record<string, string[]> = {
  "m-alex": ["What will a crown cost me?", "What if I wait until January?"],
  "m-jordan": ["Who's covered on my plan?"],
}
const CONTEXT: Record<string, object> = {
  "m-alex": {
    member_id: "m-alex", name: "Alex Rivera", age: 39, relationship: "spouse", status: "active", plan: "Preferred",
    plan_highlights: "Alex plan: $1,500 yearly max.", history: ["2026-03-02: Cleaning (you paid $0.00)"],
    preferences: ["Prefers morning visits."], must_haves: ["Crown covered"], chat_memory: [],
    shared_with_assistant: ["Plan tier and yearly numbers"],
  },
  "m-jordan": {
    member_id: "m-jordan", name: "Jordan Rivera", age: 41, relationship: "self", status: "active", plan: "Preferred",
    plan_highlights: "Jordan highlights here.", history: [], preferences: [], must_haves: [],
    chat_memory: [{ role: "user", content: "Who is covered?" }], shared_with_assistant: ["Plan tier and yearly numbers"],
  },
}

function sse(events: [string, object][]) {
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("")
}

let calls: { url: string; method: string; headers: Record<string, string>; body: string | null }[]
let chatReply: () => Response

function mockApi() {
  calls = []
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const headers = (init?.headers ?? {}) as Record<string, string>
      calls.push({ url, method: init?.method ?? "GET", headers, body: typeof init?.body === "string" ? init.body : null })
      const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200 })
      let m = url.match(/\/chat\/suggestions\?member_id=([\w-]+)/)
      if (m) return json({ member_id: m[1], suggestions: SUGG[m[1]] })
      m = url.match(/\/members\/([\w-]+)\/assistant-context/)
      if (m) return json(CONTEXT[m[1]])
      if (url.includes("/chat/attachments"))
        return json({ attachment_id: "att-1", filename: "quote.pdf", size: 10, notice: "Demo only" })
      if (init?.method === "DELETE" && /\/members\/[\w-]+\/chat$/.test(url)) return json({ ok: true, removed: 2 })
      if (url.endsWith("/chat")) return chatReply()
      return new Response("{}", { status: 404 })
    }),
  )
}

function renderPage(id = "m-alex") {
  return render(
    <TestSessionProvider activeId={id}>
      <AssistantPage />
    </TestSessionProvider>,
  )
}

beforeEach(() => {
  resetThreads()
  chatReply = () =>
    new Response(
      sse([
        ["tool_start", { name: "estimate_cost", args: {} }],
        ["tool_end", { name: "estimate_cost", result: { you_pay: 800 } }],
        ["token", { text: "A crown would cost you " }],
        ["token", { text: "$800." }],
        ["done", { mode: "anthropic" }],
      ]),
      { status: 200 },
    )
  mockApi()
})
afterEach(() => vi.restoreAllMocks())

describe("parseSse", () => {
  it("reads events and keeps a half-finished block", () => {
    const r = parseSse('event: token\ndata: {"text":"hi"}\n\nevent: done\ndata: {"mo')
    expect(r.events).toEqual([{ event: "token", data: { text: "hi" } }])
    expect(r.rest).toContain("event: done")
  })
})

describe("Assistant page", () => {
  it("shows Alex's chips and context, and streams the answer exactly as sent", { timeout: 15000 }, async () => {
    const user = userEvent.setup()
    renderPage()
    expect(screen.getByTestId("talking-about")).toHaveTextContent("Alex Rivera")
    const chip = await screen.findByRole("button", { name: "What will a crown cost me?" }, { timeout: 5000 })
    const knows = within(await screen.findByTestId("knows-panel", {}, { timeout: 5000 }))
    expect(await knows.findByText("Alex plan: $1,500 yearly max.", {}, { timeout: 5000 })).toBeInTheDocument()
    expect(knows.getByText("Prefers morning visits.")).toBeInTheDocument()

    await user.click(chip)
    expect(await screen.findByText("A crown would cost you $800.", {}, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText(/Done: Calculating your cost/)).toBeInTheDocument()

    const chat = calls.find((c) => c.url.endsWith("/chat"))!
    expect(chat.headers.Authorization).toBe("Bearer tok-m-jordan")
    const body = JSON.parse(chat.body!)
    expect(body.member_id).toBe("m-alex")
    expect(body.messages).toEqual([{ role: "user", content: "What will a crown cost me?" }])
  })

  it("keeps each person's thread, chips and context separate", async () => {
    const user = userEvent.setup()
    renderPage()
    await user.click(await screen.findByRole("button", { name: "What will a crown cost me?" }))
    await screen.findByText("A crown would cost you $800.")

    await user.click(screen.getByRole("button", { name: "Jordan" }))
    expect(screen.getByTestId("talking-about")).toHaveTextContent("Jordan Rivera")
    expect(await screen.findByRole("button", { name: "Who's covered on my plan?" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "What will a crown cost me?" })).not.toBeInTheDocument()
    expect(screen.queryByText("A crown would cost you $800.")).not.toBeInTheDocument()
    expect(await within(screen.getByTestId("knows-panel")).findByText("Jordan highlights here.")).toBeInTheDocument()
    expect(screen.getByText("Who is covered?")).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Alex" }))
    expect(await screen.findByText("A crown would cost you $800.")).toBeInTheDocument()
  })

  it("says plainly when the assistant is unavailable and can retry", async () => {
    const user = userEvent.setup()
    chatReply = () =>
      new Response(
        sse([["token", { text: "The assistant is not available right now." }], ["done", { mode: "unavailable" }]]),
        { status: 200 },
      )
    renderPage()
    await user.click(await screen.findByRole("button", { name: "What will a crown cost me?" }))
    const alert = await screen.findByRole("alert", {}, { timeout: 3000 })
    expect(alert).toHaveTextContent("The assistant is not available right now. The rest of the app still works.")

    chatReply = () => new Response(sse([["token", { text: "Back. $800." }], ["done", { mode: "anthropic" }]]), { status: 200 })
    await user.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Back. $800.")).toBeInTheDocument()
    expect(screen.queryByText(/not available right now/)).not.toBeInTheDocument()
  })

  it("shows a network failure and keeps the rest of the page working", async () => {
    const user = userEvent.setup()
    const ok = globalThis.fetch as unknown as (u: string, i?: RequestInit) => Promise<Response>
    vi.stubGlobal("fetch", vi.fn(async (u: string, i?: RequestInit) => {
      if (String(u).endsWith("/chat")) throw new Error("offline")
      return ok(u, i)
    }))
    renderPage()
    await user.click(await screen.findByRole("button", { name: "What will a crown cost me?" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("can't reach the server")
    expect(screen.getByTestId("knows-panel")).toBeInTheDocument()
  })

  it("attaches a PDF, shows it as a chip, sends its id, and removes it", async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole("button", { name: "What will a crown cost me?" })
    expect(screen.getByText(/PDF only, up to 5 MB/)).toBeInTheDocument()
    const file = new File(["%PDF-1.4"], "quote.pdf", { type: "application/pdf" })
    await user.upload(screen.getByTestId("pdf-input"), file)
    const chip = await screen.findByTestId("attachment-chip")
    expect(chip).toHaveTextContent("quote.pdf")
    const up = calls.find((c) => c.url.includes("/chat/attachments"))!
    expect(up.url).toContain("member_id=m-alex")
    expect(up.headers["Content-Type"]).toBe("application/pdf")

    await user.click(screen.getByRole("button", { name: "Remove quote.pdf" }))
    expect(screen.queryByTestId("attachment-chip")).not.toBeInTheDocument()

    await user.upload(screen.getByTestId("pdf-input"), file)
    await screen.findByTestId("attachment-chip")
    await user.type(screen.getByLabelText("Your question"), "Please read this")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(calls.some((c) => c.url.endsWith("/chat"))).toBe(true))
    const body = JSON.parse(calls.find((c) => c.url.endsWith("/chat"))!.body!)
    expect(body.attachment_ids).toEqual(["att-1"])
    await waitFor(() => expect(screen.queryByTestId("attachment-chip")).not.toBeInTheDocument())
  })

  it("rejects a file that is not a PDF without calling the server", async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderPage()
    await screen.findByRole("button", { name: "What will a crown cost me?" })
    await user.upload(screen.getByTestId("pdf-input"), new File(["x"], "photo.png", { type: "image/png" }))
    expect(await screen.findByText("Only PDF files can be attached.")).toBeInTheDocument()
    expect(calls.some((c) => c.url.includes("/chat/attachments"))).toBe(false)
  })
})

describe("Assistant page layout", () => {
  it("makes the conversation the hero: a tall card with its own scrolling message list", async () => {
    renderPage()
    await screen.findByRole("button", { name: "What will a crown cost me?" })
    const card = screen.getByTestId("chat-card")
    expect(card.className).toContain("100dvh")
    const list = screen.getByTestId("conversation")
    expect(list.className).toContain("flex-1")
    expect(list.className).toContain("overflow-y-auto")
    expect(screen.getByTestId("chip-row").className).toContain("max-h-24")
  })

  it("collapses 'What Your Assistant Knows' behind a toggle on small screens", async () => {
    const user = userEvent.setup()
    renderPage()
    const toggle = await screen.findByTestId("knows-toggle")
    const body = screen.getByTestId("knows-body")
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(body.className).toContain("hidden")
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(body.className).not.toContain("hidden")
    await user.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "false")
  })
})

describe("Clear chat", () => {
  it("asks first, then deletes this person's saved chat and empties the conversation", async () => {
    const user = userEvent.setup()
    renderPage("m-alex")
    await user.type(await screen.findByPlaceholderText("Ask about Alex's plan"), "crown?")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await screen.findByText(/\$800/)
    await user.click(screen.getByRole("button", { name: /Clear chat/ }))
    expect(screen.getByText("Delete Alex's chat history?")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Yes, clear" }))
    await waitFor(() => expect(screen.queryAllByTestId("msg-assistant")).toHaveLength(0))
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/members/m-alex/chat"))).toBe(true)
    expect(screen.getByRole("button", { name: /Clear chat/ })).toBeInTheDocument()
  })

  it("cancel keeps the conversation", async () => {
    const user = userEvent.setup()
    renderPage("m-alex")
    await user.click(await screen.findByRole("button", { name: /Clear chat/ }))
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    expect(calls.some((c) => c.method === "DELETE")).toBe(false)
  })
})
