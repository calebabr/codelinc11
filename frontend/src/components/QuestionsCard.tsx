import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Copy, Printer, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState, Skeleton } from '@/components/StateViews'
import { checklistText } from '@/components/questions/format'
import { postQuestions } from '@/lib/api'
import { usePlan } from '@/state/PlanContext'

const STORAGE_KEY = 'dental-copilot-asked-v1'

function loadAsked(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function saveAsked(s: Set<string>) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...s]))
  } catch {
    /* storage unavailable: ignore */
  }
}

function flip(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

export function QuestionsCard({ codes }: { codes: string[] }) {
  const { planRef, usage, currentMonth } = usePlan()
  const [asked, setAsked] = useState<Set<string>>(loadAsked)
  const [closed, setClosed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null)

  const q = useQuery({
    queryKey: ['questions', planRef, codes, usage, currentMonth],
    queryFn: () => postQuestions({ ...planRef, codes, usage, current_month: currentMonth }),
  })

  const total = useMemo(
    () => q.data?.sections.reduce((n, s) => n + s.questions.length, 0) ?? 0,
    [q.data],
  )
  const done = useMemo(
    () =>
      q.data?.sections.reduce((n, s) => n + s.questions.filter((x) => asked.has(x.id)).length, 0) ??
      0,
    [q.data, asked],
  )

  function toggle(id: string) {
    setAsked((prev) => {
      const next = flip(prev, id)
      saveAsked(next)
      return next
    })
  }

  async function copy() {
    if (!q.data) return
    try {
      await navigator.clipboard.writeText(checklistText(q.data, asked))
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    window.setTimeout(() => setCopied(null), 2500)
  }

  return (
    <Card data-testid="questions-card" className="print:ring-0">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Questions to ask your dentist</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.isLoading && (
          <div role="status" aria-label="Loading questions" className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-3/4" />
          </div>
        )}
        {q.isError && <ErrorState error={q.error} onRetry={() => void q.refetch()} />}
        {q.data && (
          <>
            <div
              role="note"
              className="flex items-start gap-2 rounded-xl border border-[#f5591f]/40 bg-[#f5591f]/10 p-3 text-sm"
            >
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[#f5591f]" aria-hidden="true" />
              <p>{q.data.safety_note}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium" data-testid="questions-progress">
                  {done} of {total} asked
                </span>
                <span className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={() => void copy()}>
                    {copied === 'ok' ? <Check className="size-4" /> : <Copy className="size-4" />}
                    Copy list
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="size-4" />
                    Print
                  </Button>
                </span>
              </div>
              <div
                role="progressbar"
                aria-label="Questions asked"
                aria-valuemin={0}
                aria-valuemax={total}
                aria-valuenow={done}
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div
                  className="h-full rounded-full bg-[#6b0f2a] transition-all"
                  style={{ width: `${total ? (done / total) * 100 : 0}%` }}
                />
              </div>
              <p aria-live="polite" className="min-h-4 text-xs text-muted-foreground print:hidden">
                {copied === 'ok' && 'Copied to your clipboard.'}
                {copied === 'fail' && "Couldn't copy. Try the Print button instead."}
              </p>
            </div>

            {q.data.sections.map((s) => {
              const open = !closed.has(s.id)
              const sDone = s.questions.filter((x) => asked.has(x.id)).length
              return (
                <section key={s.id} aria-label={s.title} className="space-y-2">
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setClosed((prev) => flip(prev, s.id))}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <span className="font-semibold text-[#6b0f2a]">{s.title}</span>
                    <span className="flex items-center gap-2">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {sDone}/{s.questions.length}
                      </span>
                      <ChevronDown
                        className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </span>
                  </button>
                  {open && (
                    <ul className="space-y-2">
                      {s.questions.map((item) => {
                        const on = asked.has(item.id)
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => toggle(item.id)}
                              className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                                on ? 'border-[#6b0f2a]/40 bg-[#6b0f2a]/5' : 'bg-card hover:bg-muted/50'
                              }`}
                            >
                              <span
                                aria-hidden="true"
                                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
                                  on
                                    ? 'border-[#6b0f2a] bg-[#6b0f2a] text-white'
                                    : 'border-muted-foreground/40'
                                }`}
                              >
                                {on && <Check className="size-3.5" />}
                              </span>
                              <span className="min-w-0">
                                <span
                                  className={`block text-sm font-medium ${on ? 'text-muted-foreground line-through' : ''}`}
                                >
                                  {item.text}
                                </span>
                                <span className="mt-0.5 block text-xs text-muted-foreground">
                                  {item.why}
                                </span>
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </>
        )}
      </CardContent>
    </Card>
  )
}
