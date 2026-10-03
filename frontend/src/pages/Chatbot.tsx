import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChatPanel } from "@/components/ChatPanel"
import { useUser } from "@/state/UserContext"
import { getPlan } from "@/lib/mockApi"
import { eligibilitySummary } from "@/lib/accountApi"
import {
  Brain,
  CheckCircle2,
  FileText,
  Fingerprint,
  History,
  MessageSquare,
  Star,
  Users,
  XCircle,
} from "lucide-react"

export function Chatbot() {
  const { account, activeProfile } = useUser()
  const plan = getPlan(activeProfile.planId)
  const ctx = activeProfile.aiContext
  const elig = eligibilitySummary(account)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">Plan Assistant</h1>
        <p className="text-sm text-muted-foreground">
          Answers are personalized for <strong>{activeProfile.name}</strong> using their own plan,
          history and preferences — and the assistant learns from every chat.
        </p>
      </div>

      {/* Know-your-profile: the account the chatbot retrieves by user_id */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Fingerprint className="size-4 text-primary" />
            Account the assistant retrieves
            <Badge variant="secondary" className="font-mono">
              user_id: {account.userId}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">Plan: {elig.planName}</Badge>
            <Badge variant="outline" className="capitalize">
              Tier: {elig.planTier}
            </Badge>
            <Badge variant="outline">Coverage: {elig.coverageType}</Badge>
            <Badge variant="outline" className="gap-1">
              <Users className="size-3" />
              {elig.coveredCount} of {elig.members.length} covered
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-1.5 pr-3 font-medium">Covered person</th>
                  <th className="py-1.5 pr-3 font-medium">Eligibility</th>
                  <th className="py-1.5 pr-3 font-medium">Visits / year</th>
                  <th className="py-1.5 font-medium">Major work this year</th>
                </tr>
              </thead>
              <tbody>
                {elig.members.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{m.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {m.relationship} · age {m.age}
                        {m.isFullTimeStudent ? " · student" : ""}
                      </p>
                    </td>
                    <td className="py-2 pr-3">
                      <span
                        className={`inline-flex items-center gap-1 ${
                          m.eligible ? "text-ok" : "text-destructive"
                        }`}
                      >
                        {m.eligible ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <XCircle className="size-3.5" />
                        )}
                        {m.eligible ? "Eligible" : "Not eligible"}
                      </span>
                      <p className="mt-0.5 text-xs text-muted-foreground">{m.eligibilityReason}</p>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="font-medium">
                        {m.visitsUsed} / {m.visitsPerYear}
                      </span>
                      <p className="text-xs text-muted-foreground">{m.visitsLeft} left</p>
                    </td>
                    <td className="py-2">
                      {m.hadMajorWorkThisYear ? (
                        <span className="text-warn">{m.majorWorkThisYear.join(", ")}</span>
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            The chatbot is handed the <span className="font-mono">user_id</span> and retrieves only
            this account's records. Ask it <em>"who's covered on my plan?"</em> to see this read
            back in chat.
          </p>
        </CardContent>
      </Card>

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
