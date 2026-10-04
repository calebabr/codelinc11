import { money } from "@/lib/format"
import { remindersUrl } from "@/lib/api/planYear"
import type { BenefitsStatus, QuestionsResponse, SavingsTipsResponse } from "@/lib/types/planYear"
import type { Loadable } from "./usePlanYear"

function Soft({ state, label, children }: { state: Loadable<unknown>; label: string; children: React.ReactNode }) {
  if (state.error) return <p role="alert" className="note">{label}: {state.error}</p>
  if (!state.data) return state.loading ? <p role="status" className="text-sm text-muted-foreground">Loading {label.toLowerCase()}...</p> : null
  return <>{children}</>
}

export function SavingsTipsCard({ state }: { state: Loadable<SavingsTipsResponse> }) {
  const tips = state.data?.tips ?? []
  return (
    <section aria-labelledby="py-tips" className="portal-card">
      <h2 id="py-tips" className="portal-card-title">Ways to save</h2>
      <Soft state={state} label="Savings tips">
        {tips.length === 0 ? (
          <p className="text-sm text-muted-foreground">No extra savings tips for these treatments.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {tips.map((t) => (
              <li key={t.id} className="rounded-2xl border border-line bg-white p-3" data-testid="tip">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold text-burgundy">{t.title}</p>
                  {t.saving > 0 && <span className="chip chip-ok">Could save {money(t.saving)}</span>}
                </div>
                <p className="mt-1 text-sm">{t.summary}</p>
              </li>
            ))}
          </ul>
        )}
        {state.data?.note && <p className="mt-3 text-xs text-muted-foreground">{state.data.note}</p>}
      </Soft>
    </section>
  )
}

export function QuestionsCard({ state }: { state: Loadable<QuestionsResponse> }) {
  return (
    <section aria-labelledby="py-questions" className="portal-card">
      <h2 id="py-questions" className="portal-card-title">Questions to ask your dentist</h2>
      <Soft state={state} label="Questions">
        {state.data && (
          <>
            <p className="note text-sm">{state.data.safety_note}</p>
            <div className="mt-3 space-y-4">
              {state.data.sections.map((s) => (
                <div key={s.id}>
                  <h3 className="font-bold">{s.title}</h3>
                  <ul className="mt-1 list-disc space-y-2 pl-5">
                    {s.questions.map((q) => (
                      <li key={q.id}>
                        <span className="block font-semibold">{q.text}</span>
                        <span className="block text-sm text-muted-foreground">{q.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </>
        )}
      </Soft>
    </section>
  )
}

export function CalendarReminder({ benefits }: { benefits: BenefitsStatus | null }) {
  if (!benefits) return null
  return (
    <section aria-labelledby="py-cal" className="portal-card flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="py-cal" className="portal-card-title">Don't lose your benefits</h2>
        <p className="text-sm text-muted-foreground">
          You have {money(benefits.max_remaining)} left this year. Unused benefits do not carry over.
        </p>
      </div>
      <a className="btn btn-orange" href={remindersUrl(benefits.plan_name, benefits.max_remaining)} download>
        Add reminders to my calendar
      </a>
    </section>
  )
}
