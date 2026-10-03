import { useRef, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import Reveal from '@/components/landing/Reveal'
import SplitHeading from '@/components/landing/SplitHeading'
import { SCREEN_H, SCREEN_W, screens } from '@/components/landing/screens'
import { useIsDesktop } from '@/lib/use-viewport-width'
import { ease, rise } from '@/lib/motion'
import { cn } from '@/lib/utils'

const steps = [
  { title: 'See what’s covered', text: 'Your plan in plain English, no booklet required.', screen: screens.coverage },
  { title: 'Know what you’ll owe', text: 'Describe a procedure, get a clear cost breakdown.', screen: screens.estimate },
  { title: 'Plan your year', text: 'Time your care so your benefits go further.', screen: screens.plan },
]

const INK = '#1C0A12'
const GRAY = '#9CA3AF'
const quick = { duration: 0.3, ease }

function Intro({ size = 'text-[40px] md:text-[64px]' }: { size?: string }) {
  return (
    <Reveal>
      <motion.p variants={rise} className="text-lg font-semibold text-primary md:text-xl">
        How it works
      </motion.p>
      <SplitHeading
        text="Your dental plan, *finally* on your side."
        className={cn('mt-3 max-w-4xl', size, 'leading-[1]')}
      />
    </Reveal>
  )
}

function Shot({ screen, className }: { screen: (typeof steps)[number]['screen']; className?: string }) {
  return (
    <img
      src={screen.src}
      alt={screen.alt}
      width={SCREEN_W}
      height={SCREEN_H}
      loading="lazy"
      decoding="async"
      className={cn('aspect-[4/3] w-full rounded-[16px] object-cover object-top shadow-[0_24px_50px_-24px_rgba(107,15,42,0.35)]', className)}
    />
  )
}

// Desktop: the section pins for three screens' worth of scrolling; each third makes the next step active
function ScrollSteps() {
  const ref = useRef<HTMLElement>(null)
  const [active, setActive] = useState(0)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  // Only re-render when the step changes, not on every scroll frame
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.min(2, Math.max(0, Math.floor(v * 3)))))

  // Jump to the middle of a step's third of the section
  function goTo(i: number) {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    const range = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: top + ((i + 0.5) / 3) * range, behavior: 'smooth' })
  }

  return (
    <section ref={ref} id="how-it-works" className="relative h-[300vh] overflow-x-clip">
      <div className="sticky top-0 flex h-screen items-center">
        <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-6 md:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div>
            <Intro size="text-[44px] lg:text-[64px]" />

            <div className="relative mt-10 pl-8">
              {/* Progress line: gray track, burgundy fill that grows with the scroll */}
              <div className="absolute inset-y-0 left-0 w-[2px] bg-[#E5E7EB]" aria-hidden>
                <motion.div className="h-full w-full origin-top bg-primary" style={{ scaleY: scrollYProgress }} />
              </div>

              <ol className="space-y-3">
                {steps.map((s, i) => {
                  const on = i === active
                  return (
                    <li key={s.title}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        aria-current={on ? 'step' : undefined}
                        className="flex items-center text-left font-heading text-[28px] leading-tight lg:text-[40px]"
                        style={{ letterSpacing: '-0.04em' }}
                      >
                        <motion.span
                          initial={false}
                          animate={{ opacity: on ? 1 : 0, x: on ? 0 : -8, width: on ? '1.1em' : 0 }}
                          transition={quick}
                          className="inline-flex shrink-0 overflow-hidden text-primary"
                          aria-hidden
                        >
                          <ArrowRight className="size-[0.8em]" strokeWidth={2.5} />
                        </motion.span>
                        <motion.span
                          initial={false}
                          animate={{ color: on ? INK : GRAY, fontWeight: on ? 700 : 500 }}
                          transition={quick}
                        >
                          {s.title}
                        </motion.span>
                      </button>
                      <AnimatePresence initial={false}>
                        {on ? (
                          <motion.p
                            key="text"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={quick}
                            className="overflow-hidden pt-1 text-lg text-muted-foreground"
                          >
                            {s.text}
                          </motion.p>
                        ) : (
                          <span className="sr-only">{s.text}</span>
                        )}
                      </AnimatePresence>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>

          {/* The matching screen crossfades in as the step changes */}
          <div className="rounded-[28px] bg-blush p-5 lg:p-10">
            <div className="relative aspect-[4/3]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease }}
                  className="absolute inset-0"
                >
                  <Shot screen={steps[active].screen} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// Phones and Reduce Motion: a plain stacked list, each step with its screen
function StackedSteps({ animate }: { animate: boolean }) {
  return (
    <section id="how-it-works" className="mx-auto max-w-[1200px] scroll-mt-24 px-6 py-[72px] md:py-[120px]">
      <Intro />
      <ol className="mt-12 space-y-14">
        {steps.map((s, i) => (
          <motion.li
            key={s.title}
            initial={animate ? { opacity: 0, y: 24 } : false}
            whileInView={animate ? { opacity: 1, y: 0 } : undefined}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7, ease }}
          >
            <h3 className="text-[28px]">
              <span className="sr-only">Step {i + 1}: </span>
              {s.title}
            </h3>
            <p className="mt-2 text-lg text-muted-foreground">{s.text}</p>
            <div className="mt-6 rounded-[28px] bg-blush p-4 sm:p-6">
              <Shot screen={s.screen} />
            </div>
          </motion.li>
        ))}
      </ol>
    </section>
  )
}

export default function HowItWorks() {
  const desktop = useIsDesktop()
  const reduce = useReducedMotion()
  if (desktop && !reduce) return <ScrollSteps />
  return <StackedSteps animate={!reduce} />
}
