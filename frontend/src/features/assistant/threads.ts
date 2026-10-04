// One chat thread per family member, kept in memory for the browser session.
// The page and the floating panel share it, so a person's conversation follows them.
import { useSyncExternalStore } from "react"

export interface Message {
  id: number
  role: "user" | "assistant"
  content: string
  /** Names of the tools running or finished for this answer. */
  tools: { name: string; done: boolean }[]
  status: "streaming" | "ok" | "unavailable" | "error"
  note?: string
  /** Seconds to wait before asking again (set when the server said "too many requests"). */
  retryAfter?: number
}

const threads = new Map<string, Message[]>()
const followups = new Map<string, string[]>()
const NO_FOLLOWUPS: string[] = []
const listeners = new Set<() => void>()
const EMPTY: Message[] = []
let nextId = 1

function emit() {
  listeners.forEach((l) => l())
}

export function newId() {
  return nextId++
}

export function getThread(memberId: string): Message[] {
  return threads.get(memberId) ?? EMPTY
}

export function updateThread(memberId: string, fn: (t: Message[]) => Message[]) {
  threads.set(memberId, fn(getThread(memberId)))
  emit()
}

/** Follow-up questions offered after the latest answer for this member. */
export function getFollowups(memberId: string): string[] {
  return followups.get(memberId) ?? NO_FOLLOWUPS
}

export function setFollowups(memberId: string, list: string[]) {
  if (list.length) followups.set(memberId, list)
  else if (!followups.delete(memberId)) return
  emit()
}

export function resetThreads() {
  threads.clear()
  followups.clear()
  emit()
}

export function useThread(memberId: string): Message[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => getThread(memberId),
  )
}

export function useFollowups(memberId: string): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => getFollowups(memberId),
  )
}
