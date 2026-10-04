import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { TestSessionProvider } from "@/test/session"
import { resetThreads } from "@/features/assistant/threads"
import { cleanFollowups } from "@/lib/api/assistant"
import AssistantPage from "@/pages/Assistant/AssistantPage"

const SUGG: Record<string, string[]> = {
  "m-alex": ["What will a crown cost me?"],
  "m-jordan": ["Who's covered on my plan?"],
}
const FOLLOW = ["Why is Basic cheapest?", "What if AC needs a crown?"]

function sse(events: [string, object][]) {
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("")
}
const answer = (done: object) => () =>
  new Response(sse([["token", { text: "Basic costs least." }], ["done", done]]), { status: 200 })

let chatBodies: string[]
let chatReply: () => Response

beforeEach(() => {
  resetThreads()
  chatBodies = []
  chatReply = answer({ mode: "anthropic", followups: FOLLOW })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200 })
      let m = url.match(/\/chat\/suggestions\?member_id=([\w-]+)/)
      if (m) return json({ member_id: m[1], suggestions: SUGG[m[1]] })
      m = url.match(/\/members\/([\w-]+)\/assistant-context/)
      if (m)
        return json({
          member_id: m[1], name: m[1] === "m-alex" ? "AC" : "Marc Halog", age: 40, relationship: "self",
          status: "active", plan: "Preferred", plan_highlights: "", history: [], preferences: [], must_haves: [],
          chat_memory: [], shared_with_assistant: [],
        })
      if (init?.method === "DELETE") return json({ ok: true, removed: 1 })
      if (url.endsWith("/chat")) {
        chatBodies.push(String(init?.body))
        return chatReply()
      }
      return new Response("{}", { status: 404 })
    }),
  )
})
afterEach(() => vi.restoreAllMocks())

async function askFirst(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "What will a crown cost me?" }))
  await screen.findByText("Basic costs least.")
}

describe("follow-up questions", () => {
  it("shows them as buttons after the answer, replacing the default chips", async () => {
    const user = userEvent.setup()
    render(<TestSessionProvider activeId="m-alex"><AssistantPage /></TestSessionProvider>)
    await askFirst(user)
    expect(await screen.findByText("Ask next")).toBeInTheDocument()
    for (const q of FOLLOW) expect(screen.getByRole("button", { name: q })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "What will a crown cost me?" })).not.toBeInTheDocument()
  })

  it("sends the exact text when tapped, then clears them", async () => {
    const user = userEvent.setup()
    render(<TestSessionProvider activeId="m-alex"><AssistantPage /></TestSessionProvider>)
    await askFirst(user)
    chatReply = answer({ mode: "anthropic" })
    await user.click(await screen.findByRole("button", { name: "Why is Basic cheapest?" }))
    await waitFor(() => expect(chatBodies).toHaveLength(2))
    const msgs = JSON.parse(chatBodies[1]).messages
    expect(msgs[msgs.length - 1]).toEqual({ role: "user", content: "Why is Basic cheapest?" })
    await waitFor(() => expect(screen.queryByText("Ask next")).not.toBeInTheDocument())
    expect(await screen.findByRole("button", { name: "What will a crown cost me?" })).toBeInTheDocument()
  })

  it("clear when the person types and sends their own message", async () => {
    const user = userEvent.setup()
    render(<TestSessionProvider activeId="m-alex"><AssistantPage /></TestSessionProvider>)
    await askFirst(user)
    chatReply = answer({ mode: "anthropic" })
    await user.type(screen.getByLabelText("Your question"), "hello")
    await user.click(screen.getByRole("button", { name: "Send" }))
    await waitFor(() => expect(screen.queryByText("Ask next")).not.toBeInTheDocument())
  })

  it("keeps the default chips when the answer has no follow-ups", async () => {
    chatReply = answer({ mode: "anthropic" })
    const user = userEvent.setup()
    render(<TestSessionProvider activeId="m-alex"><AssistantPage /></TestSessionProvider>)
    await askFirst(user)
    expect(screen.queryByText("Ask next")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "What will a crown cost me?" })).toBeInTheDocument()
  })

  it("does not show one person's follow-ups on another person's thread", async () => {
    const user = userEvent.setup()
    render(<TestSessionProvider activeId="m-alex"><AssistantPage /></TestSessionProvider>)
    await askFirst(user)
    await screen.findByText("Ask next")
    await user.click(screen.getByRole("button", { name: "Marc" }))
    expect(await screen.findByRole("button", { name: "Who's covered on my plan?" })).toBeInTheDocument()
    expect(screen.queryByText("Ask next")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Why is Basic cheapest?" })).not.toBeInTheDocument()
  })

  it("clears them on Clear chat", async () => {
    const user = userEvent.setup()
    render(<TestSessionProvider activeId="m-alex"><AssistantPage /></TestSessionProvider>)
    await askFirst(user)
    await screen.findByText("Ask next")
    await user.click(screen.getByRole("button", { name: /Clear chat/ }))
    await user.click(screen.getByRole("button", { name: "Yes, clear" }))
    await waitFor(() => expect(screen.queryByText("Ask next")).not.toBeInTheDocument())
  })

  it.each([["a string", "Why?"], ["an object", { a: 1 }], ["null", null], ["all non-strings", [1, null, {}]], ["empty", []], ["blank strings", ["", "  "]]])(
    "ignores malformed followups (%s) safely",
    async (_n, bad) => {
      chatReply = answer({ mode: "anthropic", followups: bad })
      const user = userEvent.setup()
      render(<TestSessionProvider activeId="m-alex"><AssistantPage /></TestSessionProvider>)
      await askFirst(user)
      expect(screen.queryByText("Ask next")).not.toBeInTheDocument()
      expect(screen.getByRole("button", { name: "What will a crown cost me?" })).toBeInTheDocument()
    },
  )
})

describe("cleanFollowups", () => {
  it("keeps good strings, trims, dedupes and caps at four", () => {
    expect(cleanFollowups([" a ", "a", 3, "b", "c", "d", "e"])).toEqual(["a", "b", "c", "d"])
    expect(cleanFollowups(undefined)).toEqual([])
  })
})
