import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { TestSessionProvider } from "@/test/session"
import { resetThreads, updateThread, type Message } from "@/features/assistant/threads"
import { fitHistory, MAX_CHAT_MESSAGES } from "@/features/assistant/useAssistant"
import AssistantPage from "@/pages/Assistant/AssistantPage"

const turn = (i: number, role: "user" | "assistant") => ({ role, content: `message ${i}` })

describe("fitHistory", () => {
  it("keeps short threads whole", () => {
    const t = [turn(0, "user"), turn(1, "assistant"), turn(2, "user")]
    expect(fitHistory(t)).toEqual(t)
  })

  it("sends at most 20 messages and starts with a user message", () => {
    const t = Array.from({ length: 31 }, (_, i) => turn(i, i % 2 === 0 ? "user" : "assistant"))
    const sent = fitHistory(t)
    expect(sent.length).toBeLessThanOrEqual(MAX_CHAT_MESSAGES)
    expect(sent[0].role).toBe("user")
    expect(sent.at(-1)).toEqual(t.at(-1))
  })

  it("sends exactly 20 when the 20th from the end is a user message", () => {
    const t = Array.from({ length: 30 }, (_, i) => turn(i, i % 2 === 0 ? "user" : "assistant"))
    const sent = fitHistory(t)
    expect(sent).toHaveLength(20)
    expect(sent[0].role).toBe("user")
  })
})

let bodies: Array<{ messages: Array<{ role: string; content: string }> }>
let chatReply: () => Response

const seeded = (): Message[] =>
  Array.from({ length: 30 }, (_, i) => ({
    id: i + 1, role: i % 2 === 0 ? "user" : "assistant", content: `earlier ${i}`, tools: [], status: "ok",
  }))

beforeEach(() => {
  resetThreads()
  bodies = []
  chatReply = () => new Response('event: token\ndata: {"text":"Sure."}\n\nevent: done\ndata: {"mode":"anthropic"}\n\n', { status: 200 })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = String(input)
      const json = (d: unknown) => new Response(JSON.stringify(d), { status: 200 })
      if (/\/chat\/suggestions/.test(url)) return json({ member_id: "m-alex", suggestions: [] })
      if (/assistant-context/.test(url))
        return json({ member_id: "m-alex", name: "Mary", age: 40, relationship: "self", status: "active", plan: "Preferred",
          plan_highlights: "", history: [], preferences: [], must_haves: [], chat_memory: [], shared_with_assistant: [] })
      if (url.endsWith("/chat")) {
        bodies.push(JSON.parse(String(init?.body)))
        return chatReply()
      }
      return new Response("{}", { status: 404 })
    }),
  )
})
afterEach(() => vi.restoreAllMocks())

function renderChat() {
  return render(
    <TestSessionProvider activeId="m-alex">
      <MemoryRouter>
        <AssistantPage />
      </MemoryRouter>
    </TestSessionProvider>,
  )
}

describe("a long chat", () => {
  it("sends only the newest messages (starting with a user message) and keeps the whole thread on screen", async () => {
    updateThread("m-alex", () => seeded())
    const user = userEvent.setup()
    renderChat()
    expect(await screen.findByText("earlier 0")).toBeInTheDocument()
    await user.type(await screen.findByRole("textbox"), "And now?")
    await user.click(screen.getByRole("button", { name: /send/i }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    const sent = bodies[0].messages
    expect(sent.length).toBeLessThanOrEqual(20)
    expect(sent[0].role).toBe("user")
    expect(sent.at(-1)).toEqual({ role: "user", content: "And now?" })
    // Nothing is removed from the screen.
    expect(screen.getByText("earlier 0")).toBeInTheDocument()
    expect(screen.getByText("earlier 29")).toBeInTheDocument()
    expect(await screen.findByText("Sure.")).toBeInTheDocument()
  })

  it("never shows the server's validation text", async () => {
    chatReply = () =>
      new Response(JSON.stringify({ detail: [{ msg: "List should have at most 20 items after validation" }] }), { status: 422 })
    const user = userEvent.setup()
    renderChat()
    await user.type(await screen.findByRole("textbox"), "Hello")
    await user.click(screen.getByRole("button", { name: /send/i }))
    expect(await screen.findByText(/could not be sent/i)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/at most 20 items/)
  })

  it("shows the expired-family message with a sign-in button on a 410", async () => {
    chatReply = () => new Response(JSON.stringify({ detail: "gone" }), { status: 410 })
    const user = userEvent.setup()
    renderChat()
    await user.type(await screen.findByRole("textbox"), "Hello")
    await user.click(screen.getByRole("button", { name: /send/i }))
    expect(await screen.findByText("Your demo family has expired. Start a new one.")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Start a new demo family" })).toBeInTheDocument()
  })
})
