import { ArrowDown, ArrowRight, Check } from 'lucide-react'
import { motion } from 'motion/react'
import { LogoMark } from '@/components/Logo'
import Reveal from '@/components/landing/Reveal'
import { rise } from '@/lib/motion'

export default function PlainEnglish() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-[72px] md:py-[120px]">
      <Reveal className="max-w-3xl">
        <motion.p variants={rise} className="eyebrow text-primary">
          Plain English
        </motion.p>
        <motion.h2 variants={rise} className="mt-3 text-[34px] leading-[1.05] md:text-[48px]">
          We read the fine print so you don't have to.
        </motion.h2>
        {/* Real feedback from a Lincoln employee we interviewed, paraphrased (not a testimonial) */}
        <motion.p variants={rise} className="mt-5 text-lg leading-relaxed text-muted-foreground">
          A Lincoln employee told us that finding their dental benefits meant downloading a PDF and digging through it.
          So we translated it.
        </motion.p>
      </Reveal>

      <Reveal className="mt-12 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]" gap={0.15}>
        <motion.figure variants={rise} className="rounded-[20px] border bg-[#faf9f7] p-7">
          <figcaption className="eyebrow text-[11px]">Your plan booklet says</figcaption>
          <blockquote className="mt-4 font-quote text-lg leading-relaxed text-muted-foreground italic">
            “Type C – Major Services: Covered at 50% of the Maximum Allowable Charge after satisfaction of the
            Deductible. Benefits are subject to the Annual Maximum…”
          </blockquote>
        </motion.figure>

        <motion.span
          variants={rise}
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"
          aria-hidden
        >
          <ArrowRight className="hidden size-5 lg:block" />
          <ArrowDown className="size-5 lg:hidden" />
        </motion.span>

        <motion.div variants={rise} className="rounded-[20px] border-2 border-primary/15 bg-blush p-7">
          <p className="eyebrow flex items-center gap-1.5 text-[11px] text-primary">
            <LogoMark className="size-4" />
            bitewise says
          </p>
          <p className="mt-4 font-heading text-[28px] leading-tight font-bold" style={{ letterSpacing: '-0.03em' }}>
            Crowns are covered at 50% after your $50 deductible.
          </p>
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-sm font-semibold text-mint-ink">
            <Check className="size-4" aria-hidden />
            No jargon
          </p>
        </motion.div>
      </Reveal>
    </section>
  )
}
