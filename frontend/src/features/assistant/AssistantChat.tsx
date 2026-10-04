import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import { FileText, Loader2, Mic, Paperclip, Send, Trash2, X } from "lucide-react"
import { useSpeechRecognition } from "@/lib/useSpeechRecognition"
import { MAX_PDF_BYTES } from "@/lib/api/assistant"
import { Disclaimer } from "@/components/Disclaimer"
import { useChat, useSuggestions } from "./useAssistant"
import type { Message } from "./threads"

const TOOL_LABELS: Record<string, string> = {
  find_procedure: "Finding the procedure…",
  estimate_cost: "Calculating your cost…",
  plan_year_schedule: "Planning the year…",
  get_benefits_status: "Checking your benefits…",
  get_member_eligibility: "Checking who is covered…",
  get_household_coverage: "Checking the household…",
}
const toolLabel = (name: string) => TOOL_LABELS[name] ?? "Looking that up…"

/** The model uses **bold**; show it as bold text and leave everything else as plain text. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i}>{part.slice(2, -2)}</strong>
        ) : (
          part
        ),
      )}
    </>
  )
}

/** "Try again" that waits out a rate limit: disabled with a countdown until the wait is over. */
function RetryButton({ onRetry, waitSeconds }: { onRetry: () => void; waitSeconds?: number }) {
  const [left, setLeft] = useState(waitSeconds ?? 0)
  useEffect(() => {
    if (left <= 0) return
    const id = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [left])
  return (
    <button type="button" className="btn btn-outline mt-2" onClick={onRetry} disabled={left > 0}>
      {left > 0 ? `Try again in ${left}s` : "Try again"}
    </button>
  )
}

function Bubble({ m, onRetry }: { m: Message; onRetry: () => void }) {
  const mine = m.role === "user"
  const failed = m.status === "unavailable" || m.status === "error"
  return (
    <li className={mine ? "flex justify-end" : "flex justify-start"} data-testid={mine ? "msg-user" : "msg-assistant"}>
      <div
        className={
          mine
            ? "max-w-[85%] break-words rounded-2xl rounded-br-sm bg-burgundy px-4 py-2 text-sm text-white md:max-w-3xl"
            : "max-w-[85%] break-words rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-2 text-sm text-ink md:max-w-3xl"
        }
      >
        {m.tools.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5" aria-label="What the assistant is doing">
            {m.tools.map((t, i) => (
              <span key={i} className={t.done ? "chip chip-ok" : "chip chip-pending"}>
                {t.done ? "Done: " : ""}
                {toolLabel(t.name)}
              </span>
            ))}
          </div>
        )}
        {m.content && <p className="whitespace-pre-wrap">{mine ? m.content : <Rich text={m.content} />}</p>}
        {m.status === "streaming" && !m.content && (
          <p className="text-[var(--muted)]" role="status">
            Thinking…
          </p>
        )}
        {failed && (
          <div role="alert" className="note">
            <p>{m.note}</p>
            <RetryButton onRetry={onRetry} waitSeconds={m.retryAfter} />
          </div>
        )}
      </div>
    </li>
  )
}

/** The chat itself: recommended questions, the conversation and the input. Used by the page and the floating panel. */
export function AssistantChat({
  token,
  memberId,
  memberName,
  onSent,
}: {
  token: string
  memberId: string
  memberName: string
  onSent?: () => void
}) {
  const {
    thread, followups, busy, send, retry, attach, removeAttachment, attachments, uploading, attachError,
    clear, clearing, clearError,
  } = useChat(token, memberId)
  const [confirmClear, setConfirmClear] = useState(false)
  const sugg = useSuggestions(token, memberId)
  const [text, setText] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLLIElement>(null)

  // Voice input (Wrigley): dictated words are appended to whatever is already typed.
  const baseTextRef = useRef("")
  const onTranscript = useCallback((spoken: string, isFinal: boolean) => {
    const base = baseTextRef.current
    const combined = base ? `${base} ${spoken}` : spoken
    setText(combined)
    if (isFinal) baseTextRef.current = combined
  }, [])
  const speech = useSpeechRecognition({ onTranscript })
  const toggleVoice = () => {
    if (!speech.listening) baseTextRef.current = text.trim()
    speech.toggle()
  }

  useEffect(() => {
    setText("")
    setConfirmClear(false)
  }, [memberId])
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" })
  }, [thread])

  const submit = (q: string) => {
    if (!q.trim() || busy) return
    if (speech.listening) speech.stop()
    setText("")
    baseTextRef.current = ""
    void send(q).then(() => onSent?.())
  }
  const onForm = (e: FormEvent) => {
    e.preventDefault()
    submit(text)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="assistant-chat">
      <div className="flex min-h-11 flex-wrap items-center justify-end gap-2 border-b border-line px-3 py-0.5 text-xs">
        {clearError && (
          <span role="alert" className="mr-auto text-[var(--warn-ink)]">
            {clearError}
          </span>
        )}
        {confirmClear ? (
          <>
            <span className="text-ink">Delete {memberName}&apos;s chat history?</span>
            <button
              type="button"
              className="btn btn-orange !px-3 !py-1 text-sm"
              disabled={clearing}
              onClick={() => void clear().then(() => setConfirmClear(false))}
            >
              {clearing ? "Clearing…" : "Yes, clear"}
            </button>
            <button type="button" className="btn btn-outline !px-3 !py-1 text-sm" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 px-1 font-semibold text-[var(--muted)] hover:text-burgundy disabled:opacity-50"
            disabled={busy}
            onClick={() => setConfirmClear(true)}
            title="Delete this person's saved chat so the assistant starts fresh"
          >
            <Trash2 className="size-3.5" aria-hidden /> Clear chat
          </button>
        )}
      </div>
      <ul
        data-testid="conversation"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 sm:p-4"
        aria-live="polite"
        aria-label={`Conversation about ${memberName}`}
      >
        {thread.length === 0 && (
          <li className="text-sm text-[var(--muted)]">
            Ask a question about {memberName}&apos;s dental plan, or tap one of the questions below.
          </li>
        )}
        {thread.map((m) => (
          <Bubble key={m.id} m={m} onRetry={() => void retry()} />
        ))}
        <li ref={endRef} aria-hidden className="h-0" />
      </ul>

      <div className="shrink-0 border-t border-line bg-soft p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3">
        {followups.length > 0 ? (
          <div className="mb-2" aria-label="Ask next" role="group" data-testid="followups">
            <p className="mb-1 text-[0.7rem] font-bold uppercase tracking-wide text-[var(--muted)]">Ask next</p>
            <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" data-testid="chip-row">
              {followups.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => submit(q)}
                  className="min-h-11 rounded-full border border-line bg-white px-3 py-1 text-left text-[0.8rem] font-semibold leading-snug text-burgundy hover:border-orange disabled:opacity-50 sm:min-h-9"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
        <div className="mb-2" aria-label="Suggested questions" role="group">
          {sugg.loading && <p className="text-xs text-[var(--muted)]">Loading questions…</p>}
          {sugg.error && (
            <p className="text-xs text-[var(--muted)]">
              We could not load suggested questions.{" "}
              <button type="button" className="underline" onClick={sugg.retry}>
                Try again
              </button>
            </p>
          )}
          <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto" data-testid="chip-row">
            {sugg.data?.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => submit(q)}
                className="min-h-11 rounded-full border border-line bg-white px-3 py-1 text-left text-[0.8rem] font-semibold leading-snug text-burgundy hover:border-orange disabled:opacity-50 sm:min-h-9"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
        )}

        {(attachments.length > 0 || uploading || attachError) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {attachments.map((a) => (
              <span key={a.attachment_id} className="chip chip-ok" data-testid="attachment-chip">
                <FileText className="size-3.5" aria-hidden />
                {a.filename}
                <button
                  type="button"
                  className="-mr-2 inline-flex size-11 items-center justify-center"
                  aria-label={`Remove ${a.filename}`}
                  onClick={() => removeAttachment(a.attachment_id)}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </span>
            ))}
            {uploading && (
              <span className="chip chip-pending" role="status">
                <Loader2 className="size-3.5 animate-spin" aria-hidden /> Uploading…
              </span>
            )}
            {attachError && (
              <span role="alert" className="text-xs text-warn-ink">
                {attachError}
              </span>
            )}
          </div>
        )}

        {speech.error && (
          <p role="alert" className="mb-2 text-xs text-[var(--warn-ink)]">
            {speech.error}
          </p>
        )}
        <form onSubmit={onForm} className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            aria-label="Choose a PDF to attach"
            data-testid="pdf-input"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void attach(f)
              e.target.value = ""
            }}
          />
          <button
            type="button"
            className="btn btn-outline shrink-0 !px-3"
            aria-label="Attach a PDF"
            onClick={() => fileRef.current?.click()}
            disabled={busy || uploading}
          >
            <Paperclip className="size-4" aria-hidden />
          </button>
          <label className="min-w-0 flex-1">
            <span className="sr-only">Your question</span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={speech.listening ? "Listening…" : `Ask about ${memberName}'s plan`}
              className="h-11 w-full rounded-full border border-line bg-white px-4 text-base"
            />
          </label>
          {speech.supported && (
            <button
              type="button"
              className={`btn shrink-0 !px-3 ${speech.listening ? "btn-orange" : "btn-outline"}`}
              aria-label={speech.listening ? "Stop voice input" : "Start voice input"}
              aria-pressed={speech.listening}
              title={speech.listening ? "Stop voice input" : "Speak your question"}
              onClick={toggleVoice}
              disabled={busy}
            >
              <Mic className="size-4" aria-hidden />
            </button>
          )}
          <button type="submit" className="btn btn-orange shrink-0 !px-4" disabled={busy || !text.trim()} aria-label="Send">
            <Send className="size-4" aria-hidden />
          </button>
        </form>
        <p className="mt-1.5 text-[0.7rem] leading-tight text-[var(--muted)]">
          PDF only, up to {MAX_PDF_BYTES / 1024 / 1024} MB. Demo only: attach sample documents, not real health records.
        </p>
        <Disclaimer />
      </div>
    </div>
  )
}
