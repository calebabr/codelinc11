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
}

const threads = new Map<string, Message[]>()
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

export function resetThreads() {
  threads.clear()
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
