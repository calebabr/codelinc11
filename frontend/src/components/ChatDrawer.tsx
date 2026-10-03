import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, Loader2, MessageCircle, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { getHealth } from '@/lib/api'
import { streamChat } from '@/lib/chat'
import type { ChatMessage, ChatMode } from '@/lib/types'
import { usePlan } from '@/state/PlanContext'

const SUGGESTED = [
  'What will a crown cost me?',
  'What if I wait until January?',
  'How much do I have left?',
]

const TOOL_LABELS: Record<string, string> = {
  find_procedure: 'finding the procedure',
  estimate_cost: 'cost estimate',
  plan_year_schedule: 'plan-year schedule',
  get_benefits_status: 'your benefits',
}

interface ToolChip {
  key: number
  name: string
  done: boolean
}

interface UiMessage extends ChatMessage {
  tools?: ToolChip[]
  error?: boolean
}

export function ChatDrawer() {
  const { planRef, usage, currentMonth } = usePlan()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<UiMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [doneMode, setDoneMode] = useState<ChatMode | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)
  const toolKey = useRef(0)

  const health = useQuery({ queryKey: ['health'], queryFn: getHealth, enabled: open })
  const mode: ChatMode | null = doneMode ?? health.data?.chat_mode ?? null
  const modeLabel = mode === 'ollama' ? 'AI: Ollama' : mode === 'fallback' ? 'AI: offline mode' : 'AI: checking…'

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' })
  }, [messages])

  useEffect(() => () => abortRef.current?.abort(), [])

  function patchLast(fn: (m: UiMessage) => UiMessage) {
    setMessages((ms) => (ms.length === 0 ? ms : [...ms.slice(0, -1), fn(ms[ms.length - 1])]))
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const history: ChatMessage[] = [...messages, { role: 'user' as const, content }].map(
      ({ role, content }) => ({ role, content }),
    )
    setMessages((ms) => [...ms, { role: 'user', content }, { role: 'assistant', content: '', tools: [] }])
    setInput('')
    setBusy(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    await streamChat(
      { messages: history, ...planRef, usage, current_month: currentMonth },
      {
        onToolStart: (name) => {
          const key = ++toolKey.current
          patchLast((m) => ({ ...m, tools: [...(m.tools ?? []), { key, name, done: false }] }))
        },
        onToolEnd: (name) =>
          patchLast((m) => ({
            ...m,
            tools: (m.tools ?? []).map((t) => (t.name === name && !t.done ? { ...t, done: true } : t)),
          })),
        onToken: (t) => patchLast((m) => ({ ...m, content: m.content + t })),
        onDone: (md) => setDoneMode(md),
        onError: (message) =>
          patchLast((m) => ({
            ...m,
            error: true,
            content: m.content || message,
          })),
      },
      ctrl.signal,
    )
    setBusy(false)
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        aria-label="Open chat assistant"
        className="fixed right-4 bottom-4 z-40 h-12 rounded-full bg-brand-orange px-5 text-white shadow-lg hover:bg-brand-orange/90"
      >
        <MessageCircle /> Ask a question
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="w-full gap-0 sm:max-w-md" aria-describedby="chat-desc">
          <SheetHeader className="border-b pr-12">
            <SheetTitle>Ask about your dental benefits</SheetTitle>
            <SheetDescription id="chat-desc" className="flex items-center gap-2">
              <span
                data-testid="chat-mode"
                className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground"
              >
                {modeLabel}
              </span>
              <span>Answers use your plan and what you've used so far.</span>
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Not sure where to start? Try one of these:</p>
                <div className="flex flex-col gap-2">
                  {SUGGESTED.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-xl border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] space-y-2 rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-brand text-white'
                      : m.error
                        ? 'border border-destructive/40 bg-destructive/5'
                        : 'bg-muted'
                  }`}
                >
                  {m.tools && m.tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.tools.map((t) => (
                        <span
                          key={t.key}
                          className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground"
                        >
                          {t.done ? <Check className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
                          {t.done ? 'Calculated' : 'Calculating…'} {TOOL_LABELS[t.name] ?? t.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.content || (m.role === 'assistant' && busy && i === messages.length - 1 && !m.tools?.length ? '…' : m.content)}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>

          <form
            className="flex gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <Input
              aria-label="Your question"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              className="h-10 text-base"
            />
            <Button type="submit" size="icon-lg" disabled={busy || !input.trim()} aria-label="Send message">
              <Send />
            </Button>
          </form>
          <p className="px-4 pb-3 text-xs text-muted-foreground">
            This is an estimate, not a guarantee. Your actual cost depends on your dentist's charges and claim review.
          </p>
        </SheetContent>
      </Sheet>
    </>
  )
}
