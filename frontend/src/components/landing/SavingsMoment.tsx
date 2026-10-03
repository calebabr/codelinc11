import { motion } from 'motion/react'
import Reveal from '@/components/landing/Reveal'
import { ease, rise } from '@/lib/motion'

// Golden scenarios G3 and G4 (FEATURES.md §2): a $1,200 crown with $400 of the max left vs after the Jan 1 reset.
const rows = [
  { label: 'Crown now', plan: { amount: '$400', value: 400 }, you: { amount: '$800', value: 800 } },
  { label: 'Crown after Jan 1', plan: { amount: '$575', value: 575 }, you: { amount: '$625', value: 625 } },
]
const TOTAL = 1200 // the crown's cost; bar widths only

function CompareBar({ row, i }: { row: (typeof rows)[number]; i: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-base font-bold">{row.label}</p>
        <p className="text-sm text-muted-foreground">
          You pay <span className="money text-2xl text-foreground">{row.you.amount}</span>
        </p>
      </div>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${row.label}: plan pays ${row.plan.amount}, you pay ${row.you.amount}`}>
        <motion.span
          className="h-full bg-primary"
          initial={{ width: 0 }}
          whileInView={{ width: `${(row.plan.value / TOTAL) * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease, delay: 0.2 + i * 0.25 }}
        />
        <motion.span
          className="h-full border-l-2 border-white bg-[#d1d5db]"
          initial={{ width: 0 }}
          whileInView={{ width: `${(row.you.value / TOTAL) * 100}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease, delay: 0.2 + i * 0.25 }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Plan pays <span className="font-bold text-primary tabular-nums">{row.plan.amount}</span>
      </p>
    </div>
  )
}

export default function SavingsMoment() {
  return (
    <section className="bg-blush">
      <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-6 py-[72px] md:py-[120px] lg:grid-cols-2">
        <Reveal>
          <motion.p variants={rise} className="eyebrow text-primary">
            Plan your year
          </motion.p>
          <motion.h2 variants={rise} className="mt-3 text-[34px] leading-[1.05] md:text-[48px]">
            Small timing, real savings.
          </motion.h2>
          <motion.p variants={rise} className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Your annual max resets every year. If your crown can safely wait until it does, your plan pays more and you
            pay less.
          </motion.p>
        </Reveal>

        <Reveal className="relative">
          <motion.div variants={rise} className="space-y-8 rounded-[20px] bg-white p-7 md:p-9">
            <p className="text-sm text-muted-foreground">A $1,200 crown, with $400 left in your max this year</p>
            {rows.map((row, i) => (
              <CompareBar key={row.label} row={row} i={i} />
            ))}
          </motion.div>
          <motion.span
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease, delay: 1.1 }}
            className="absolute -top-5 right-6 inline-flex items-center rounded-full bg-savings-ink px-5 py-2.5 text-base font-bold text-white shadow-[0_12px_30px_-10px_rgba(255,79,23,0.6)]"
          >
            <span className="money mr-1.5 text-xl">$175</span> saved
          </motion.span>
        </Reveal>
      </div>
    </section>
  )
}
