import { BookOpen, Calculator, CalendarRange } from 'lucide-react'
import { motion } from 'motion/react'
import Reveal from '@/components/landing/Reveal'
import { rise } from '@/lib/motion'

const steps = [
  { icon: BookOpen, title: "See what's covered", text: 'Your plan in plain English, no booklet required.' },
  { icon: Calculator, title: "Know what you'll owe", text: 'Describe a procedure, get a clear cost breakdown.' },
  { icon: CalendarRange, title: 'Plan your year', text: 'Time your care so your benefits go further.' },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-[1200px] scroll-mt-24 px-6 py-[72px] md:py-[120px]">
      <Reveal>
        <motion.p variants={rise} className="eyebrow text-primary">
          How it works
        </motion.p>
        <motion.h2 variants={rise} className="mt-3 max-w-3xl text-[34px] leading-[1.05] md:text-[48px]">
          Your dental plan, finally on your side.
        </motion.h2>
      </Reveal>

      <Reveal className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map(({ icon: Icon, title, text }) => (
          <motion.article key={title} variants={rise} className="rounded-[20px] border p-7">
            <span className="flex size-12 items-center justify-center rounded-full bg-blush text-primary" aria-hidden>
              <Icon className="size-6" />
            </span>
            <h3 className="mt-6 text-2xl">{title}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{text}</p>
          </motion.article>
        ))}
      </Reveal>
    </section>
  )
}
