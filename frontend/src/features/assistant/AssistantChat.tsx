import { useEffect, useRef, useState, type FormEvent } from "react"
import { FileText, Loader2, Paperclip, Send, X } from "lucide-react"
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

function Bubble({ m, onRetry }: { m: Message; onRetry: () => void }) {
  const mine = m.role === "user"
  const failed = m.status === "unavailable" || m.status === "error"
  return (
    <li className={mine ? "flex justify-end" : "flex justify-start"} data-testid={mine ? "msg-user" : "msg-assistant"}>
      <div
        className={
          mine
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-burgundy px-4 py-2 text-sm text-white"
            : "max-w-[90%] rounded-2xl rounded-bl-sm border border-line bg-white px-4 py-2 text-sm text-ink"
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
            <button type="button" className="btn btn-outline mt-2" onClick={onRetry}>
              Try again
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

/** The chat itself: recommended questions, the conversation and the input. Used by the page and the floating panel. */
export function AssistantChat({
  signInAs,
  memberId,
  memberName,
  onSent,
}: {
  signInAs: string
  memberId: string
  memberName: string
  onSent?: () => void
}) {
  const { thread, busy, send, retry, attach, removeAttachment, attachments, uploading, attachError } = useChat(
    signInAs,
    memberId,
  )
  const sugg = useSuggestions(signInAs, memberId)
  const [text, setText] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLLIElement>(null)

  useEffect(() => setText(""), [memberId])
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" })
  }, [thread])

  const submit = (q: string) => {
    if (!q.trim() || busy) return
    setText("")
    void send(q).then(() => onSent?.())
  }
  const onForm = (e: FormEvent) => {
    e.preventDefault()
    submit(text)
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="assistant-chat">
      <ul
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
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

      <div className="border-t border-line bg-soft p-3">
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
          <div className="flex flex-wrap gap-2">
            {sugg.data?.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => submit(q)}
                className="rounded-full border border-line bg-white px-3 py-1.5 text-left text-xs font-semibold text-burgundy hover:border-orange disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {(attachments.length > 0 || uploading || attachError) && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {attachments.map((a) => (
              <span key={a.attachment_id} className="chip chip-ok" data-testid="attachment-chip">
                <FileText className="size-3.5" aria-hidden />
                {a.filename}
                <button
                  type="button"
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
              placeholder={`Ask about ${memberName}'s plan`}
              className="h-11 w-full rounded-full border border-line bg-white px-4 text-sm"
            />
          </label>
          <button type="submit" className="btn btn-orange shrink-0 !px-4" disabled={busy || !text.trim()} aria-label="Send">
            <Send className="size-4" aria-hidden />
          </button>
        </form>
        <p className="mt-2 text-[0.7rem] text-[var(--muted)]">
          PDF only, up to {MAX_PDF_BYTES / 1024 / 1024} MB. Demo only: attach sample documents, not real health records.
        </p>
        <Disclaimer />
      </div>
    </div>
  )
}
