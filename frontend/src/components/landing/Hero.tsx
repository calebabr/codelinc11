import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight, PiggyBank } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { ease, rise, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'

// A small card that pops in after the screenshot, then drifts up and down slowly
function FloatingCard({
  delay,
  drift,
  className,
  cardClassName = 'bg-white p-4',
  children,
}: {
  delay: number
  drift: number
  className?: string
  cardClassName?: string
  children: ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease, delay }}
      className={cn('absolute z-10', className)}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 6, ease: 'easeInOut', repeat: Infinity, delay: drift }}
        className={cn('rounded-[20px] shadow-[0_18px_40px_-12px_rgba(28,10,18,0.25)]', cardClassName)}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// Soft organic blob behind the product shot
function Blob({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 600 560" className={className} aria-hidden>
      <path
        fill="var(--blush)"
        d="M318 18c88 6 178 50 228 128s46 178 4 262-130 140-226 148-196-20-262-90S-4 300 16 214 92 60 168 32s62-20 150-14Z"
      />
    </svg>
  )
}

export default function Hero() {
  return (
    <section className="mx-auto grid max-w-[1200px] items-center gap-16 px-6 pt-12 pb-[72px] md:pb-[120px] lg:grid-cols-[1fr_1.05fr] lg:pt-20">
      <motion.div variants={stagger(0.1)} initial="hidden" animate="show">
        <motion.p
          variants={rise}
          className="inline-flex items-center gap-2 rounded-full bg-blush px-4 py-1.5 text-sm font-semibold text-primary"
        >
          <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          For Lincoln Financial dental members
        </motion.p>
        <motion.h1
          variants={rise}
          className="mt-6 text-[40px] leading-[1.02] md:text-[64px]"
          style={{ letterSpacing: '-0.035em' }}
        >
          Know what you'll pay before you're in the chair.
        </motion.h1>
        <motion.p variants={rise} className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
          Bitewise turns your dental plan into plain English, estimates your costs, and plans your care so you get the
          most from your benefits.
        </motion.p>
        <motion.div variants={rise} className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            to="/signup"
            className="inline-flex h-13 items-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <a
            href="#how-it-works"
            className="inline-flex h-13 items-center rounded-full px-6 text-base font-bold text-foreground transition-colors hover:bg-accent"
          >
            See how it works
          </a>
        </motion.div>
      </motion.div>

      <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
        <Blob className="absolute -inset-x-6 -inset-y-10 h-[calc(100%+5rem)] w-[calc(100%+3rem)]" />

        {/* Product screenshot in a soft browser frame */}
        <motion.figure
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease, delay: 0.45 }}
          className="relative overflow-hidden rounded-[20px] border border-white/60 bg-white shadow-[0_30px_60px_-20px_rgba(107,15,42,0.25)]"
        >
          <div className="flex items-center gap-2 border-b bg-[#faf7f8] px-4 py-3" aria-hidden>
            <span className="size-2.5 rounded-full bg-[#e5dadd]" />
            <span className="size-2.5 rounded-full bg-[#e5dadd]" />
            <span className="size-2.5 rounded-full bg-[#e5dadd]" />
            <span className="ml-3 h-6 flex-1 rounded-full bg-white px-3 text-[11px] leading-6 text-muted-foreground">
              bitewise.app/coverage
            </span>
          </div>
          <img
            src="/coverage.webp"
            alt="The bitewise My Coverage screen: $400 left of a $1,500 annual max, and what each part of the plan covers"
            className="aspect-[4/3.3] w-full object-cover object-top"
          />
        </motion.figure>

        {/* Golden numbers: filling with the deductible met; crown now ($800) vs after Jan 1 ($625) */}
        <FloatingCard delay={0.9} drift={0} className="-bottom-6 -left-4 w-48 sm:-left-10">
          <p className="text-xs font-semibold text-muted-foreground">Filling · back tooth</p>
          <p className="mt-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">You pay</p>
          <p className="money text-[34px] text-primary">$40</p>
          <div className="mt-2 flex h-2 overflow-hidden rounded-full" aria-hidden>
            <span className="w-4/5 bg-primary" />
            <span className="w-1/5 bg-[#d1d5db]" />
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">Plan pays $160</p>
        </FloatingCard>

        <FloatingCard delay={1.05} drift={1.5} className="-top-6 -right-3 sm:-right-8" cardClassName="bg-peach p-3 pr-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-savings-ink" aria-hidden>
              <PiggyBank className="size-5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Can it wait until Jan 1?</p>
              <p className="text-[15px] font-bold text-foreground">
                Save <span className="money text-xl text-savings-ink">$175</span>
              </p>
            </div>
          </div>
        </FloatingCard>
      </div>
    </section>
  )
}
