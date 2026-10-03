import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Disclaimer } from "@/components/Disclaimer"
import { useUser } from "@/state/UserContext"
import { benefitsStatus, getPlan } from "@/lib/mockApi"
import { money, formatDate } from "@/lib/format"
import {
  CalendarDays,
  FileText,
  MapPin,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
} from "lucide-react"
import type { ScheduleEvent } from "@/lib/types"

const KIND_STYLE: Record<ScheduleEvent["kind"], string> = {
  cleaning: "bg-emerald-100 text-emerald-800",
  procedure: "bg-blue-100 text-blue-800",
  reminder: "bg-amber-100 text-amber-800",
}

const PDFS = [
  { name: "Summary of Benefits.pdf", size: "212 KB" },
  { name: "Dental PPO Certificate.pdf", size: "1.1 MB" },
  { name: "2026 Fee Schedule (27401).pdf", size: "88 KB" },
]

export function Dashboard({ onOpenChat }: { onOpenChat: () => void }) {
  const { activeProfile } = useUser()
  const plan = getPlan(activeProfile.planId)
  const status = benefitsStatus(plan, activeProfile.usage)
  const usedPct = Math.round((status.maxUsed / status.annualMax) * 100)
  const nextEvents = [...activeProfile.schedule]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, {activeProfile.name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">
            {plan.name} · Benefit period {plan.benefitPeriod}
          </p>
        </div>
        <Button onClick={onOpenChat} className="gap-1.5">
          <Sparkles className="size-4" />
          Ask the assistant
        </Button>
      </div>

      {/* Benefits snapshot */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Annual max left</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{money(status.maxLeft)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {money(status.maxUsed)} of {money(status.annualMax)} used
            </p>
            <Progress value={usedPct} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Deductible met</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {money(status.deductibleMet)}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {money(status.deductible)}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Waived for cleanings & exams</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Cleanings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {status.cleaningsUsed}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                of {status.cleaningsLimit}
              </span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">used this plan year</p>
          </CardContent>
        </Card>
      </div>

      {/* Unused benefit reminder */}
      {status.unusedPreventiveValue > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-medium">
              {money(status.unusedPreventiveValue)} of free preventive care is unused
            </p>
            <p className="text-sm">
              Your cleanings reset at the end of the benefit period. Book before Dec 31 so you
              don't lose them.
            </p>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Upcoming schedule — next 3 events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" />
              Upcoming schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {nextEvents.length === 0 && (
              <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
            )}
            {nextEvents.map((e) => (
              <div key={e.id} className="flex items-start gap-3">
                <Badge className={`${KIND_STYLE[e.kind]} border-transparent`}>{e.kind}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(e.date)}</p>
                  {e.note && <p className="mt-0.5 text-xs text-muted-foreground">{e.note}</p>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Find a dentist + PDFs */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="size-4 text-primary" />
                Find a dentist
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">
                See dentists near you — green pins are in your network, gray are out of network.
              </p>
              <Button variant="outline" asChild>
                <a
                  href="https://www.google.com/maps/search/dentist+near+me"
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin className="size-4" />
                  Open coverage map
                </a>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Plan documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PDFS.map((pdf) => (
                <button
                  key={pdf.name}
                  className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <FileText className="size-4 text-muted-foreground" />
                  <span className="flex-1 text-sm">{pdf.name}</span>
                  <span className="text-xs text-muted-foreground">{pdf.size}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dental history */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-primary" />
            Recent dental history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeProfile.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No procedures on file yet.</p>
          ) : (
            <div className="divide-y">
              {activeProfile.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{h.procedureName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(h.date)} · {h.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">You paid {money(h.youPaid)}</p>
                    <p className="text-xs text-muted-foreground">Plan paid {money(h.planPaid)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Disclaimer />
    </div>
  )
}
