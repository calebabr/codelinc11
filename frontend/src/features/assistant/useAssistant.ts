import { useCallback, useEffect, useState } from "react"
import {
  cleanFollowups,
  clearChat,
  errorMessage,
  getAssistantContext,
  getSuggestions,
  MAX_PDF_BYTES,
  streamChat,
  uploadAttachment,
} from "@/lib/api/assistant"
import { ApiError } from "@/lib/api/planYear"
import type { AssistantContext, AttachmentInfo, ChatScope, ChatTurn, StreamEvent } from "@/lib/types/assistant"
import { getThread, newId, setFollowups, updateThread, useFollowups, useThread, type Message } from "./threads"

const UNAVAILABLE = "The assistant is not available right now. The rest of the app still works."

interface Loaded<T> {
  data: T | null
  loading: boolean
  error: string | null
}

function useLoaded<T>(load: () => Promise<T>, key: string): Loaded<T> & { retry: () => void } {
  const [state, setState] = useState<Loaded<T>>({ data: null, loading: true, error: null })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    setState({ data: null, loading: true, error: null })
    load().then(
      (data) => !cancelled && setState({ data, loading: false, error: null }),
      (e) => !cancelled && setState({ data: null, loading: false, error: errorMessage(e) }),
    )
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}

/** The server's suggested questions, or a fixed list when a scoped page supplies its own. */
export const useSuggestions = (token: string, memberId: string, fixed?: string[]) =>
  useLoaded(() => (fixed ? Promise.resolve(fixed) : getSuggestions(token, memberId)), `${token}|${memberId}|${fixed ? "fixed" : "server"}`)

export const useAssistantContext = (token: string, memberId: string, refreshKey = 0) =>
  useLoaded<AssistantContext>(() => getAssistantContext(token, memberId), `${token}|${memberId}|${refreshKey}`)

function turnsOf(thread: Message[]): ChatTurn[] {
  return thread
    .filter((m) => m.status === "ok" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
}

/** The server accepts at most 20 messages per request (backend models.py). */
export const MAX_CHAT_MESSAGES = 20

/** The most recent messages that fit in one request. The first one sent is always from the user. */
export function fitHistory(turns: ChatTurn[]): ChatTurn[] {
  const recent = turns.slice(-MAX_CHAT_MESSAGES)
  const firstUser = recent.findIndex((t) => t.role === "user")
  return firstUser <= 0 ? recent : recent.slice(firstUser)
}

const CHAT_FAILED = "That message could not be sent. Please try again. If it keeps happening, clear the chat and start fresh."

/** Plain words for a failed chat call. A 422 is the server's validation text, which people should never see. */
function chatErrorMessage(e: unknown): string {
  if (e instanceof ApiError && e.status === 422) return CHAT_FAILED
  return errorMessage(e)
}

/** Chat state for one member. Switching the member shows that person's own thread. */
export function useChat(token: string, memberId: string, scope?: ChatScope) {
  // A scoped chat (for example reports) keeps its own conversation, apart from the general one.
  const threadKey = scope ? `${scope}:${memberId}` : memberId
  const thread = useThread(threadKey)
  const followups = useFollowups(threadKey)
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([])
  const [uploading, setUploading] = useState(false)
  const [attachError, setAttachError] = useState<string | null>(null)
  const busy = thread.some((m) => m.status === "streaming")

  // Attachments belong to one person; never carry them to another thread.
  useEffect(() => {
    setAttachments([])
    setAttachError(null)
  }, [memberId])

  const run = useCallback(
    async (history: ChatTurn[], ids: string[]) => {
      const answerId = newId()
      const patch = (fn: (m: Message) => Message) =>
        updateThread(threadKey, (t) => t.map((m) => (m.id === answerId ? fn(m) : m)))
      updateThread(threadKey, (t) => [
        ...t,
        { id: answerId, role: "assistant", content: "", tools: [], status: "streaming" },
      ])
      setFollowups(threadKey, [])
      let unavailable = false
      let nextFollowups: string[] = []
      let failed = false
      const onEvent = (e: StreamEvent) => {
        if (e.event === "token") patch((m) => ({ ...m, content: m.content + e.data.text }))
        else if (e.event === "tool_start")
          patch((m) => ({ ...m, tools: [...m.tools, { name: e.data.name, done: false }] }))
        else if (e.event === "tool_end")
          patch((m) => {
            const i = m.tools.findIndex((x) => x.name === e.data.name && !x.done)
            return i < 0 ? m : { ...m, tools: m.tools.map((x, j) => (j === i ? { ...x, done: true } : x)) }
          })
        else if (e.event === "done") {
          unavailable = e.data.mode === "unavailable"
          nextFollowups = cleanFollowups(e.data.followups)
        }
        else if (e.event === "error") failed = true
      }
      try {
        await streamChat(token, memberId, fitHistory(history), ids, onEvent, undefined, scope)
        if (unavailable) patch((m) => ({ ...m, status: "unavailable", note: UNAVAILABLE }))
        else if (failed)
          patch((m) => ({ ...m, status: "error", note: "Something went wrong while answering. Please try again." }))
        else {
          patch((m) => ({ ...m, status: "ok" }))
          setFollowups(threadKey, nextFollowups)
        }
      } catch (e) {
        const wait = e instanceof ApiError && e.status === 429 ? e.retryAfter : undefined
        patch((m) => ({ ...m, status: "error", note: chatErrorMessage(e), retryAfter: wait }))
      }
    },
    [token, memberId, threadKey, scope],
  )

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || getThread(threadKey).some((m) => m.status === "streaming")) return
      const history = [...turnsOf(getThread(threadKey)), { role: "user" as const, content: clean }]
      const ids = attachments.map((a) => a.attachment_id)
      updateThread(threadKey, (t) => [...t, { id: newId(), role: "user", content: clean, tools: [], status: "ok" }])
      setAttachments([])
      await run(history, ids)
    },
    [threadKey, attachments, run],
  )

  /** Ask the last question again after an error or an unavailable answer. */
  const retry = useCallback(async () => {
    const t = getThread(threadKey)
    const last = t[t.length - 1]
    if (!last || last.role !== "assistant" || (last.status !== "error" && last.status !== "unavailable")) return
    updateThread(threadKey, (x) => x.slice(0, -1))
    await run(turnsOf(getThread(threadKey)), [])
  }, [threadKey, run])

  const attach = useCallback(
    async (file: File) => {
      setAttachError(null)
      if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
        setAttachError("Only PDF files can be attached.")
        return
      }
      if (file.size > MAX_PDF_BYTES) {
        setAttachError("That file is too large. The limit is 5 MB.")
        return
      }
      setUploading(true)
      try {
        const info = await uploadAttachment(token, memberId, file)
        setAttachments((a) => [...a, info])
      } catch (e) {
        setAttachError(errorMessage(e))
      } finally {
        setUploading(false)
      }
    },
    [token, memberId],
  )

  const removeAttachment = useCallback(
    (id: string) => setAttachments((a) => a.filter((x) => x.attachment_id !== id)),
    [],
  )

  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState<string | null>(null)
  useEffect(() => setClearError(null), [memberId])

  /** Delete this person's saved chat on the server, then empty the conversation on screen. */
  const clear = useCallback(async () => {
    setClearError(null)
    setClearing(true)
    try {
      await clearChat(token, memberId)
      updateThread(threadKey, () => [])
      setFollowups(threadKey, [])
      setAttachments([])
    } catch (e) {
      setClearError(errorMessage(e))
    } finally {
      setClearing(false)
    }
  }, [token, memberId, threadKey])

  return {
    thread, followups, busy, send, retry, attach, removeAttachment, attachments, uploading, attachError,
    clear, clearing, clearError,
  }
}
