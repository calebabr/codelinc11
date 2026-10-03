import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { PageHeading } from '@/components/AppShell'
import { Disclaimer } from '@/components/Disclaimer'
import { ErrorState, LoadingBlock } from '@/components/StateViews'
import { useCatalog } from '@/components/ProcedureGrid'
import { buildHandoff } from '@/components/quote/buildHandoff'
import { QuoteItemCard } from '@/components/quote/QuoteItemCard'
import { SAMPLE_TREATMENT_PLAN } from '@/components/quote/sample'
import { UnmatchedPanel } from '@/components/quote/UnmatchedPanel'
import { Button } from '@/components/ui/button'
import { postTreatmentPlanParse } from '@/lib/api'
import type { Page } from '@/lib/nav'
import type { ParsedTreatment, TreatmentPlanParseResponse, Urgency } from '@/lib/types'
import { usePlan } from '@/state/PlanContext'

export function TreatmentPlan({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { planRef, setDraft } = usePlan()
  const catalog = useCatalog()
  const [text, setText] = useState('')
  const [result, setResult] = useState<TreatmentPlanParseResponse | null>(null)
  const [items, setItems] = useState<ParsedTreatment[]>([])

  const parse = useMutation({
    mutationFn: (t: string) => postTreatmentPlanParse({ text: t, ...planRef }),
    onSuccess: (data) => {
      setResult(data)
      setItems(data.items)
    },
  })

  const categoryOf = (code: string | null) =>
    code ? catalog.procedures.find((p) => p.code === code)?.category : undefined

  const matchedCount = items.filter((i) => i.matched).length

  function setUrgency(id: string, urgency: Urgency) {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, urgency } : i)))
  }

  function optimize() {
    setDraft(buildHandoff(items))
    onNavigate('plan-year')
  }

  return (
    <div className="space-y-6">
      <PageHeading
        title="Your dentist's quote"
        subtitle="Paste the treatment plan your dentist gave you and we'll read it for you."
      />

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <label htmlFor="quote-text" className="text-sm font-medium">
          Treatment plan text
        </label>
        <textarea
          id="quote-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          placeholder={'One line per procedure, for example:\nTooth 19  Crown, porcelain  D2740  $1,200'}
          className="w-full rounded-lg border bg-background p-3 font-mono text-sm focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setText(SAMPLE_TREATMENT_PLAN)
            }}
          >
            Use a sample treatment plan
          </Button>
          <Button
            onClick={() => parse.mutate(text)}
            disabled={!text.trim() || parse.isPending}
            className="bg-brand text-white hover:bg-brand/90"
          >
            Read my plan
          </Button>
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            Your quote stays in this browser tab and isn't saved. Paste text for now; photo and file upload isn't
            available yet.
          </span>
        </p>
      </section>

      {parse.isPending && <LoadingBlock label="Reading your treatment plan" />}
      {parse.isError && <ErrorState error={parse.error} onRetry={() => parse.mutate(text)} />}

      {result && !parse.isPending && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                result.mode === 'ollama' ? 'bg-violet-100 text-violet-900' : 'bg-muted text-muted-foreground'
              }`}
            >
              {result.mode === 'ollama' ? 'Read with AI' : 'Read with rules'}
            </span>
          </div>
          {result.notes.length > 0 && (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}

          {items.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((i) => (
                <QuoteItemCard
                  key={i.id}
                  item={i}
                  category={categoryOf(i.code)}
                  onUrgency={(u) => setUrgency(i.id, u)}
                  onRemove={() => setItems((list) => list.filter((x) => x.id !== i.id))}
                />
              ))}
            </ul>
          )}

          <UnmatchedPanel lines={result.unmatched_lines} />

          <div className="space-y-2">
            <Button
              size="lg"
              onClick={optimize}
              disabled={matchedCount === 0}
              className="w-full bg-brand-orange text-white hover:bg-brand-orange/90 sm:w-auto"
            >
              Optimize my year with these
            </Button>
            <p className="text-xs text-muted-foreground">
              We'll find the cheapest order for you. Urgent care always stays in this plan year.
            </p>
          </div>
          <Disclaimer />
        </div>
      )}
    </div>
  )
}
