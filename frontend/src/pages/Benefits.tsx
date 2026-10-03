import { useMutation, useQuery } from '@tanstack/react-query'
import { BellRing, CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeading } from '@/components/AppShell'
import { MonthStrip } from '@/components/Controls'
import { Disclaimer } from '@/components/Disclaimer'
import { Term } from '@/components/Glossary'
import { MaxGauge, MaxRadialGauge } from '@/components/MaxGauge'
import { ProcedureGrid, useCatalog } from '@/components/ProcedureGrid'
import { ErrorState, LoadingBlock } from '@/components/StateViews'
import { postBenefitsStatus, postEstimate, remindersUrl } from '@/lib/api'
import { money, plural } from '@/lib/format'
import type { EstimateResponse } from '@/lib/types'
import { usePlan } from '@/state/PlanContext'

function useLogVisit() {
  const { planRef, usage, logVisit } = usePlan()
  return useMutation<EstimateResponse, Error, string>({
    mutationFn: (code) => postEstimate({ ...planRef, code, usage }),
    onSuccess: (res, code) => logVisit(code, res.in_network.max_used_after, res.in_network.deductible_applied),
  })
}

export function LogVisit() {
  const catalog = useCatalog()
  const log = useLogVisit()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Log a visit</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Had dental work? Tap what you had done and your numbers update.
        </p>
        <ProcedureGrid
          procedures={catalog.procedures}
          loading={catalog.isLoading}
          error={catalog.error}
          onRetry={() => catalog.refetch()}
          onPick={(p) => log.mutate(p.code)}
          verb="Log visit:"
        />
        {log.isPending && <p className="text-sm text-muted-foreground">Logging…</p>}
        {log.isError && <ErrorState error={log.error} />}
        {log.isSuccess && (
          <p role="status" className="text-sm text-emerald-700">
            Logged {log.data.in_network.name}. Your plan paid {money(log.data.in_network.plan_pays)}.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export function Benefits() {
  const { planRef, usage, currentMonth, setCurrentMonth } = usePlan()
  const log = useLogVisit()
  const q = useQuery({
    queryKey: ['benefits', planRef, usage, currentMonth],
    queryFn: () => postBenefitsStatus({ ...planRef, usage, current_month: currentMonth }),
  })
  const s = q.data

  return (
    <div className="space-y-6">
      <PageHeading
        title="My benefits"
        subtitle="See what you have left this plan year and avoid leaving money on the table."
      />

      {q.isLoading && <LoadingBlock label="Loading your benefits" />}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}

      {s && (
        <>
          {s.reminder && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-brand-orange/40 bg-orange-50 p-4"
            >
              <BellRing className="mt-0.5 size-5 shrink-0 text-brand-orange" aria-hidden="true" />
              <p className="font-medium text-orange-950">{s.reminder}</p>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-brand to-brand-orange" />
            <CardContent className="space-y-6 pt-5">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Left of your <Term term="annualMax" /> ({s.plan_name})
                </p>
                <MaxRadialGauge used={s.max_used} total={s.annual_max} remaining={s.max_remaining} />
                <p className="text-sm text-muted-foreground">
                  {s.months_left} {plural(s.months_left, 'month')} left in your plan year
                </p>
              </div>
              <MonthStrip
                label="Months left this plan year"
                value={currentMonth}
                onChange={setCurrentMonth}
                caption="Orange months are still ahead of you. Tap a month to see your benefits then."
              />
              <MaxGauge
                label="Deductible met"
                used={s.deductible_met}
                total={s.deductible}
                remainingText={`${money(s.deductible_remaining)} to go before your plan starts sharing costs on basic and major care`}
              />
            </CardContent>
          </Card>

          {s.frequencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Visits your plan covers each year</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {s.frequencies.map((f) => (
                  <div key={f.code} className="space-y-1.5">
                    <p className="flex flex-wrap items-baseline justify-between gap-2 text-sm font-medium">
                      <span>{f.name}</span>
                      <span className="text-muted-foreground">
                        {f.used} of {f.limit} used
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-2" role="group" aria-label={`${f.name} visits`}>
                      {Array.from({ length: f.limit }, (_, i) => i + 1).map((n) => {
                        const done = n <= f.used
                        return (
                          <button
                            key={n}
                            type="button"
                            disabled={done || log.isPending}
                            aria-pressed={done}
                            aria-label={`${f.name} visit ${n} ${done ? 'done' : 'not done. Tap to log it'}`}
                            onClick={() => log.mutate(f.code)}
                            className={`flex h-14 min-w-24 flex-col items-center justify-center rounded-xl border-2 px-3 text-sm font-medium ${
                              done
                                ? 'border-emerald-600 bg-emerald-50 text-emerald-900'
                                : 'border-dashed bg-card text-muted-foreground hover:border-emerald-400'
                            }`}
                          >
                            <span aria-hidden="true">{done ? '🦷 ✓' : '🦷'}</span>
                            <span>Visit {n} {done ? 'done' : 'open'}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
                {s.unused_preventive_value > 0 && (
                  <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
                    Your unused preventive visits are worth about {money(s.unused_preventive_value)} at typical
                    prices. They're covered in full, so use them before the year ends.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Button asChild className="h-11 bg-brand-orange text-white hover:bg-brand-orange/90">
            <a href={remindersUrl(s.plan_name, s.max_remaining, currentMonth)}>
              <CalendarPlus /> Add to calendar
            </a>
          </Button>
        </>
      )}

      <LogVisit />
      <Disclaimer />
    </div>
  )
}
