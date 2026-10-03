import { BarChart3, CalendarClock, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Disclaimer } from '@/components/Disclaimer'
import type { Page } from '@/lib/nav'
import { usePlan } from '@/state/PlanContext'

const FEATURES = [
  {
    icon: BarChart3,
    title: 'See your cost up front',
    text: 'Search for a procedure in plain words and see exactly what you and your plan would pay, step by step.',
  },
  {
    icon: CalendarClock,
    title: 'Plan your year',
    text: 'Timing matters. We show when to schedule treatment so you get the most from your yearly maximum.',
  },
  {
    icon: ShieldCheck,
    title: 'Use it before you lose it',
    text: 'Track what you have left and get a reminder before your benefits reset.',
  },
]

export function Landing({ onNavigate }: { onNavigate: (p: Page) => void }) {
  const { selectPlan, resetUsage, setCurrentMonth } = usePlan()
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff3ee] to-background">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-14 text-center sm:py-24">
        <span className="rounded-full bg-brand px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase">
          Dental Benefits Copilot
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-brand sm:text-6xl">
          Know what you'll owe before you sit in the chair
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Dental insurance is confusing. Tell us about your plan and we'll explain, in plain English, what
          a procedure will cost you and how to make your benefits go further.
        </p>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button size="lg" className="h-12 px-6 text-base" onClick={() => onNavigate('setup')}>
            Get started
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-12 border-brand-orange px-6 text-base text-brand hover:bg-brand-orange/10"
            onClick={() => {
              selectPlan('demo_ppo')
              resetUsage()
              setCurrentMonth(11)
              onNavigate('estimate')
            }}
          >
            Try the demo plan
          </Button>
        </div>
        <ul className="grid w-full gap-4 text-left sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <li key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
              <Icon className="mb-2 size-6 text-brand-orange" aria-hidden="true" />
              <h2 className="font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </li>
          ))}
        </ul>
        <Disclaimer className="max-w-xl text-left" />
      </div>
    </div>
  )
}
