import { AssistantChat } from "@/features/assistant/AssistantChat"
import { KnowsPanel } from "@/features/assistant/KnowsPanel"
import { useThread } from "@/features/assistant/threads"
import { useSession } from "@/state/SessionContext"

export default function AssistantPage() {
  const { household, activeMember, setActiveMemberId, token } = useSession()
  const thread = useThread(activeMember.id)
  // Reload "what the assistant knows" after each finished answer (new chat memory).
  const answered = thread.filter((m) => m.role === "assistant" && m.status === "ok").length

  return (
    <div className="wrap !px-0 sm:!px-0 -my-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-2xl font-bold text-burgundy">Assistant</h1>
        <p className="text-sm font-semibold text-ink">
          Talking about: <span data-testid="talking-about">{activeMember.name}</span>
        </p>
        <div role="group" aria-label="Choose who to talk about" className="flex flex-wrap gap-1.5">
          {household.members.map((m) => {
            const on = m.id === activeMember.id
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={on}
                onClick={() => setActiveMemberId(m.id)}
                className={
                  "min-h-11 rounded-full border px-3 py-1 text-sm font-semibold transition-colors " +
                  (on
                    ? "border-orange bg-[var(--tint-orange)] text-burgundy"
                    : "border-line bg-white text-ink hover:border-orange")
                }
              >
                {m.name.split(" ")[0]}
                {m.status === "pending" ? " (pending)" : ""}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-2 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section
          aria-label="Chat"
          data-testid="chat-card"
          className="portal-card flex h-[calc(100dvh-12rem)] min-h-[26rem] flex-col overflow-hidden !p-0"
        >
          <AssistantChat token={token} memberId={activeMember.id} memberName={activeMember.name.split(" ")[0]} />
        </section>
        <KnowsPanel token={token} memberId={activeMember.id} refreshKey={answered} />
      </div>
    </div>
  )
}
