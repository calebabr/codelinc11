import { API_URL, ApiError, DEMO_MONTH } from "@/lib/api/planYear"
import type { AssistantContext, AttachmentInfo, ChatTurn, StreamEvent, SuggestionsResponse } from "@/lib/types/assistant"

export { errorMessage } from "@/lib/api/planYear"

export const MAX_PDF_BYTES = 5 * 1024 * 1024
export const UNREACHABLE = "We can't reach the server right now. Please try again in a moment."

async function authedFetch(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    throw new ApiError(UNREACHABLE)
  }
}

async function failure(res: Response): Promise<ApiError> {
  let detail = ""
  try {
    const b = await res.json()
    if (typeof b?.detail === "string") detail = b.detail
  } catch {
    /* ignore */
  }
  return new ApiError(detail || `The server returned an error (${res.status}).`, res.status)
}

export async function getSuggestions(token: string, memberId: string): Promise<string[]> {
  const res = await authedFetch(token, `/chat/suggestions?member_id=${encodeURIComponent(memberId)}`)
  if (!res.ok) throw await failure(res)
  return ((await res.json()) as SuggestionsResponse).suggestions
}

export async function getAssistantContext(token: string, memberId: string): Promise<AssistantContext> {
  const res = await authedFetch(token, `/members/${encodeURIComponent(memberId)}/assistant-context`)
  if (!res.ok) throw await failure(res)
  return (await res.json()) as AssistantContext
}

export async function uploadAttachment(token: string, memberId: string, file: File): Promise<AttachmentInfo> {
  const q = new URLSearchParams({ member_id: memberId, filename: file.name })
  const res = await authedFetch(token, `/chat/attachments?${q.toString()}`, {
    method: "POST",
    headers: { "Content-Type": "application/pdf" },
    body: file,
  })
  if (!res.ok) throw await failure(res)
  return (await res.json()) as AttachmentInfo
}

/** Parse Server-Sent Events text into events. Returns the unparsed rest. */
export function parseSse(buffer: string): { events: StreamEvent[]; rest: string } {
  const events: StreamEvent[] = []
  const blocks = buffer.split(/\r?\n\r?\n/)
  const rest = blocks.pop() ?? ""
  for (const block of blocks) {
    let name = ""
    const data: string[] = []
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) name = line.slice(6).trim()
      else if (line.startsWith("data:")) data.push(line.slice(5).trim())
    }
    if (!name || data.length === 0) continue
    try {
      events.push({ event: name, data: JSON.parse(data.join("\n")) } as StreamEvent)
    } catch {
      /* skip a broken block */
    }
  }
  return { events, rest }
}

/** Send a chat message and call onEvent for every streamed event. Throws ApiError if the request fails. */
export async function streamChat(
  token: string,
  memberId: string,
  messages: ChatTurn[],
  attachmentIds: string[],
  onEvent: (e: StreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await authedFetch(token, "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, member_id: memberId, attachment_ids: attachmentIds, current_month: DEMO_MONTH }),
    signal,
  })
  if (!res.ok) throw await failure(res)
  if (!res.body) {
    for (const e of parseSse((await res.text()) + "\n\n").events) onEvent(e)
    return
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ""
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const { events, rest } = parseSse(buf)
    buf = rest
    events.forEach(onEvent)
  }
  buf += decoder.decode()
  parseSse(buf + "\n\n").events.forEach(onEvent)
}
