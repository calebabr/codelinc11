import type { ReactNode } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export const GLOSSARY: Record<string, { label: string; text: string }> = {
  deductible: {
    label: 'deductible',
    text: 'The amount you pay yourself each year before your plan starts sharing the cost. Cleanings and checkups usually skip it.',
  },
  coinsurance: {
    label: 'coinsurance',
    text: 'The share of the bill your plan pays after the deductible. For example, 80% means the plan pays 80% and you pay 20%.',
  },
  annualMax: {
    label: 'annual max',
    text: 'The most your plan will pay in one plan year. After that, you pay the full cost until the plan year resets.',
  },
  balanceBilling: {
    label: 'balance billing',
    text: "When a dentist outside your plan's network charges more than the plan's allowed amount, you pay the difference.",
  },
}

export function Term({ term, children }: { term: keyof typeof GLOSSARY; children?: ReactNode }) {
  const g = GLOSSARY[term]
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`What is ${g.label}?`}
            className="cursor-help underline decoration-dotted decoration-brand-orange underline-offset-4"
          >
            {children ?? g.label}
          </button>
        </TooltipTrigger>
        <TooltipContent>{g.text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
