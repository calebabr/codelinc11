import { Link } from "react-router"
import { AssistantChat } from "@/features/assistant/AssistantChat"
import { useSession } from "@/state/SessionContext"
import { SYNTHETIC_NOTICE } from "@/features/reports/notice"

const REPORT_QUESTIONS = [
  "What do I owe right now?",
  "Explain my last EOB",
  "Why was this claim denied?",
  "Which visits are still unpaid?",
]

export default function ReportsAskPage() {
  const { activeMember, token } = useSession()
  const first = activeMember.name.split(" ")[0]
  return (
    <div className="wrap !px-0 sm:!px-0 -my-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link to="/reports" className="inline-flex min-h-11 items-center font-semibold text-burgundy underline">Back to Reports</Link>
        <h1 className="text-2xl font-bold text-burgundy">Ask about my reports</h1>
        <p className="text-sm font-semibold text-ink">
          Talking about: <span data-testid="talking-about">{activeMember.name}</span>
        </p>
      </div>
      <p className="note mt-2 text-sm" data-testid="synthetic-notice">{SYNTHETIC_NOTICE}</p>
      <section
        aria-label="Chat about reports"
        data-testid="chat-card"
        className="portal-card mt-2 flex h-[calc(100dvh-14rem)] min-h-[26rem] flex-col overflow-hidden !p-0"
      >
        <AssistantChat token={token} memberId={activeMember.id} memberName={first} scope="reports" suggestions={REPORT_QUESTIONS} />
      </section>
    </div>
  )
}
