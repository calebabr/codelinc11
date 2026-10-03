import { useEffect, useRef, useState } from "react"
import { Send, Sparkles, Wrench, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useUser } from "@/state/UserContext"
import { answer } from "@/lib/chat"
import type { ChatMessage, ToolCall } from "@/lib/types"

const TOOL_LABELS: Record<string, string> = {
  retrieve_account: "Looking up your account…",
  get_eligibility: "Checking eligibility…",
  find_procedure: "Finding procedure…",
  estimate_cost: "Calculating cost…",
  get_benefits_status: "Checking your benefits…",
  plan_year_schedule: "Planning your year…",
  get_plan_details: "Reading your plan…",
  get_history: "Reading your history…",
  search_plan_docs: "Searching plan documents…",
}

const SUGGESTIONS = [
  "Who's covered on my plan?",
  "What will a crown cost me?",
  "What if I wait until January?",
  "What do I have left this year?",
  "Plan my year",
]

function renderText(text: string) {
  // Minimal markdown: **bold** and newlines.
  return text.split("\n").map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).filter(Boolean)
    return (
      <span key={i} className="block min-h-[1.1em]">
        {parts.map((p, j) => {
          if (p.startsWith("**") && p.endsWith("**"))
            return (
              <strong key={j} className="font-semibold text-foreground">
                {p.slice(2, -2)}
              </strong>
            )
          if (p.startsWith("_") && p.endsWith("_"))
            return (
              <em key={j} className="text-muted-foreground">
                {p.slice(1, -1)}
              </em>
            )
          return <span key={j}>{p}</span>
        })}
      </span>
    )
  })
}

export function ChatPanel() {
  const { userId, activeProfile, learn } = useUser()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [liveTools, setLiveTools] = useState<ToolCall[]>([])
  const [streaming, setStreaming] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Reset the conversation when the active profile changes — context is per user.
  useEffect(() => {
    setMessages([
      {
        id: "intro",
        role: "assistant",
        text: `Hi ${activeProfile.name.split(" ")[0]}! I already know your plan and history. Ask me anything about your coverage.`,
      },
    ])
    setStreaming("")
    setLiveTools([])
  }, [activeProfile.id, activeProfile.name])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages, streaming, liveTools])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setInput("")
    setBusy(true)
    const userMsg: ChatMessage = { id: `u${Date.now()}`, role: "user", text: trimmed }
    setMessages((m) => [...m, userMsg])

    // Hand the chatbot the user_id + active person; it retrieves the account.
    const result = answer(trimmed, userId, activeProfile.id)

    // Simulate tool-call chips arriving one at a time.
    for (const tool of result.tools) {
      setLiveTools((t) => [...t, { ...tool, status: "running" }])
      await delay(420)
      setLiveTools((t) => t.map((x) => (x.name === tool.name ? { ...x, status: "done" } : x)))
    }
    await delay(150)

    // Stream the text token by token.
    const tokens = result.text.match(/\S+\s*/g) ?? [result.text]
    let acc = ""
    for (const tok of tokens) {
      acc += tok
      setStreaming(acc)
      await delay(14)
    }

    // Commit the finished message and clear the live state.
    setMessages((m) => [
      ...m,
      { id: `a${Date.now()}`, role: "assistant", text: result.text, tools: result.tools },
    ])
    setStreaming("")
    setLiveTools([])

    // "Learn": fold the new context back into this profile's record.
    learn(activeProfile.id, result.learned)
    setBusy(false)
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex size-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Sparkles className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium leading-none">Plan Assistant</p>
          <p className="text-xs text-muted-foreground">
            Personalized for {activeProfile.name}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-auto"
          onClick={() => setMessages((m) => m.slice(0, 1))}
          aria-label="Clear conversation"
        >
          <RotateCcw className="size-4" />
        </Button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((msg) => (
          <Bubble key={msg.id} role={msg.role}>
            {renderText(msg.text)}
          </Bubble>
        ))}

        {liveTools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {liveTools.map((t) => (
              <Badge
                key={t.name}
                variant={t.status === "done" ? "secondary" : "outline"}
                className="gap-1"
              >
                <Wrench className="size-3" />
                {t.status === "done" ? (TOOL_LABELS[t.name]?.replace("…", " ✓") ?? t.name) : TOOL_LABELS[t.name] ?? t.name}
              </Badge>
            ))}
          </div>
        )}

        {streaming && <Bubble role="assistant">{renderText(streaming)}</Bubble>}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5 border-t px-4 py-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        className="flex items-center gap-2 border-t px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your coverage…"
          disabled={busy}
          aria-label="Message"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
          <Send className="size-4" />
        </Button>
      </form>
    </div>
  )
}

function Bubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user"
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        }`}
      >
        {children}
      </div>
    </div>
  )
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
