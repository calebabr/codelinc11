import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { money } from '@/lib/format'
import type { TraceStep } from '@/lib/types'

export function MathTrace({ trace }: { trace: TraceStep[] }) {
  return (
    <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
      <AccordionItem value="math" className="border-b-0">
        <AccordionTrigger className="text-base">Show the math</AccordionTrigger>
        <AccordionContent>
          <ol className="space-y-3">
            {trace.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-semibold text-white"
                >
                  {i + 1}
                </span>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{step.label}</span>
                    <span className="font-semibold">{money(step.amount)}</span>
                  </div>
                  <p className="text-muted-foreground">{step.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
