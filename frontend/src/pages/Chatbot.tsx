import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChatPanel } from "@/components/ChatPanel"
import { useUser } from "@/state/UserContext"
import { getPlan } from "@/lib/mockApi"
import { Brain, FileText, History, MessageSquare, Star } from "lucide-react"

export function Chatbot() {
  const { activeProfile } = useUser()
  const plan = getPlan(activeProfile.planId)
  const ctx = activeProfile.aiContext

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Plan Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Answers are personalized for <strong>{activeProfile.name}</strong> using their own plan,
          history and preferences — and the assistant learns from every chat.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Chat */}
        <div className="h-[32rem] lg:h-[36rem]">
          <ChatPanel />
        </div>

        {/* The retrieved AI context — this is what makes answers personal */}
        <Card className="self-start">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-4 text-primary" />
              What the assistant knows
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ContextBlock
              icon={<FileText className="size-3.5" />}
              title="Plan highlights"
              items={[
                `${plan.name}: ${plan.benefitPeriod}`,
                ...ctx.planHighlights,
              ]}
            />
            <ContextBlock
              icon={<History className="size-3.5" />}
              title="Previous procedures"
              items={ctx.previousProcedures}
              empty="None yet"
            />
            <ContextBlock
              icon={<MessageSquare className="size-3.5" />}
              title="Previous questions"
              items={ctx.previousQuestions}
              empty="None yet"
            />
            <ContextBlock
              icon={<Star className="size-3.5" />}
              title="Preferences"
              items={[...ctx.preferences, ...activeProfile.mustHaves.map((m) => `Must-have: ${m}`)]}
              empty="None yet"
            />
            <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
              Each profile has its own private context, keyed by user id. Switching profiles loads
              a different person's data.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ContextBlock({
  icon,
  title,
  items,
  empty,
}: {
  icon: React.ReactNode
  title: string
  items: string[]
  empty?: string
}) {
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {title}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground/70">{empty ?? "—"}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map((it, i) => (
            <Badge key={i} variant="outline" className="h-auto max-w-full whitespace-normal py-1 text-left">
              {it}
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
