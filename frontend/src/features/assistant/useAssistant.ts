import { useCallback, useEffect, useState } from "react"
import {
  errorMessage,
  getAssistantContext,
  getSuggestions,
  MAX_PDF_BYTES,
  streamChat,
  uploadAttachment,
} from "@/lib/api/assistant"
import type { AssistantContext, AttachmentInfo, ChatTurn, StreamEvent } from "@/lib/types/assistant"
import { getThread, newId, updateThread, useThread, type Message } from "./threads"

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

export const useSuggestions = (signInAs: string, memberId: string) =>
  useLoaded(() => getSuggestions(signInAs, memberId), `${signInAs}|${memberId}`)

export const useAssistantContext = (signInAs: string, memberId: string, refreshKey = 0) =>
  useLoaded<AssistantContext>(() => getAssistantContext(signInAs, memberId), `${signInAs}|${memberId}|${refreshKey}`)

function turnsOf(thread: Message[]): ChatTurn[] {
  return thread
    .filter((m) => m.status === "ok" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))
}

/** Chat state for one member. Switching the member shows that person's own thread. */
export function useChat(signInAs: string, memberId: string) {
  const thread = useThread(memberId)
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
        updateThread(memberId, (t) => t.map((m) => (m.id === answerId ? fn(m) : m)))
      updateThread(memberId, (t) => [
        ...t,
        { id: answerId, role: "assistant", content: "", tools: [], status: "streaming" },
      ])
      let unavailable = false
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
        else if (e.event === "done") unavailable = e.data.mode === "unavailable"
        else if (e.event === "error") failed = true
      }
      try {
        await streamChat(signInAs, memberId, history, ids, onEvent)
        if (unavailable) patch((m) => ({ ...m, status: "unavailable", note: UNAVAILABLE }))
        else if (failed)
          patch((m) => ({ ...m, status: "error", note: "Something went wrong while answering. Please try again." }))
        else patch((m) => ({ ...m, status: "ok" }))
      } catch (e) {
        patch((m) => ({ ...m, status: "error", note: errorMessage(e) }))
      }
    },
    [signInAs, memberId],
  )

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || getThread(memberId).some((m) => m.status === "streaming")) return
      const history = [...turnsOf(getThread(memberId)), { role: "user" as const, content: clean }]
      const ids = attachments.map((a) => a.attachment_id)
      updateThread(memberId, (t) => [...t, { id: newId(), role: "user", content: clean, tools: [], status: "ok" }])
      setAttachments([])
      await run(history, ids)
    },
    [memberId, attachments, run],
  )

  /** Ask the last question again after an error or an unavailable answer. */
  const retry = useCallback(async () => {
    const t = getThread(memberId)
    const last = t[t.length - 1]
    if (!last || last.role !== "assistant" || (last.status !== "error" && last.status !== "unavailable")) return
    updateThread(memberId, (x) => x.slice(0, -1))
    await run(turnsOf(getThread(memberId)), [])
  }, [memberId, run])

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
        const info = await uploadAttachment(signInAs, memberId, file)
        setAttachments((a) => [...a, info])
      } catch (e) {
        setAttachError(errorMessage(e))
      } finally {
        setUploading(false)
      }
    },
    [signInAs, memberId],
  )

  const removeAttachment = useCallback(
    (id: string) => setAttachments((a) => a.filter((x) => x.attachment_id !== id)),
    [],
  )

  return { thread, busy, send, retry, attach, removeAttachment, attachments, uploading, attachError }
}
