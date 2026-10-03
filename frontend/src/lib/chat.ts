import { fetchEventSource } from '@microsoft/fetch-event-source'
import { API_URL } from './api'
import type { ChatMode, ChatRequest } from './types'

export interface ChatHandlers {
  onToolStart?: (name: string, args: unknown) => void
  onToolEnd?: (name: string, result: unknown) => void
  onToken?: (text: string) => void
  onDone?: (mode: ChatMode) => void
  onError?: (message: string) => void
}

class FatalChatError extends Error {}

/** Streams POST /chat server-sent events. Resolves when the stream ends. */
export async function streamChat(
  req: ChatRequest,
  handlers: ChatHandlers,
  signal?: AbortSignal,
): Promise<void> {
  try {
    await fetchEventSource(`${API_URL}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(req),
      signal,
      openWhenHidden: true,
      async onopen(res) {
        if (!res.ok) throw new FatalChatError(`The chat service returned an error (${res.status}).`)
      },
      onmessage(ev) {
        if (!ev.event) return
        let data: Record<string, unknown> = {}
        try {
          data = ev.data ? (JSON.parse(ev.data) as Record<string, unknown>) : {}
        } catch {
          return
        }
        switch (ev.event) {
          case 'tool_start':
            handlers.onToolStart?.(String(data.name ?? ''), data.args)
            break
          case 'tool_end':
            handlers.onToolEnd?.(String(data.name ?? ''), data.result)
            break
          case 'token':
            handlers.onToken?.(String(data.text ?? ''))
            break
          case 'done':
            handlers.onDone?.((data.mode as ChatMode) ?? 'fallback')
            break
          case 'error':
            handlers.onError?.(String(data.message ?? 'Something went wrong.'))
            break
        }
      },
      onerror(err) {
        // Throwing stops the library from retrying forever.
        throw err
      },
    })
  } catch (err) {
    if (signal?.aborted) return
    if (err instanceof FatalChatError) handlers.onError?.(err.message)
    else handlers.onError?.("Can't reach the server: is the backend running on port 8000?")
  }
}
