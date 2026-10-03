// Shapes for the assistant. They mirror backend/app/routers/chat.py and backend/app/agent/context.py.

export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export type ChatMode = "anthropic" | "ollama" | "template" | "unavailable"

export type StreamEvent =
  | { event: "tool_start"; data: { name: string; args?: unknown } }
  | { event: "tool_end"; data: { name: string; result?: unknown } }
  | { event: "token"; data: { text: string } }
  | { event: "done"; data: { mode?: ChatMode } }
  | { event: "error"; data: { message?: string } }

export interface SuggestionsResponse {
  member_id: string
  suggestions: string[]
}

export interface AssistantContext {
  member_id: string
  name: string
  age: number
  relationship: string
  status: string
  status_note?: string | null
  plan: string
  plan_highlights: string
  history: string[]
  preferences: string[]
  must_haves: string[]
  chat_memory: ChatTurn[]
  shared_with_assistant: string[]
}

export interface AttachmentInfo {
  attachment_id: string
  filename: string
  size: number
  notice: string
}

export interface ChatBody {
  messages: ChatTurn[]
  member_id: string
  attachment_ids: string[]
  current_month: number
}
