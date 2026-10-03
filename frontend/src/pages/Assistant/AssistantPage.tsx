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
    <div className="wrap py-8">
      <h1 className="text-3xl font-bold text-burgundy sm:text-4xl">Assistant</h1>
      <p className="mt-2 text-lg font-semibold text-ink">
        Talking about: <span data-testid="talking-about">{activeMember.name}</span>
      </p>
      <div role="group" aria-label="Choose who to talk about" className="mt-4 flex flex-wrap gap-2">
        {household.members.map((m) => {
          const on = m.id === activeMember.id
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={on}
              onClick={() => setActiveMemberId(m.id)}
              className={
                "rounded-full border px-4 py-2 text-sm font-semibold transition-colors " +
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

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section
          aria-label="Chat"
          className="portal-card flex h-[34rem] max-h-[80vh] flex-col overflow-hidden !p-0"
        >
          <AssistantChat token={token} memberId={activeMember.id} memberName={activeMember.name.split(" ")[0]} />
        </section>
        <KnowsPanel token={token} memberId={activeMember.id} refreshKey={answered} />
      </div>
    </div>
  )
}
