import { useLayoutEffect, useRef, type ReactNode } from 'react'
import TryDemoButton from '@/components/auth/TryDemoButton'
import { PiggyBank } from 'lucide-react'
import {
  easeInOut,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionStyle,
} from 'motion/react'
import { ease, rise, stagger } from '@/lib/motion'
import SplitHeading from '@/components/landing/SplitHeading'
import { fanStartPose, SCREEN_H, SCREEN_SIZES, SCREEN_W, screens } from '@/components/landing/screens'
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
        className={cn('rounded-[20px] shadow-[0_18px_40px_-12px_rgba(28,28,30,0.25)]', cardClassName)}
      >
        {children}
      </motion.div>
    </motion.div>
  )
}

// Soft organic blob behind the product shot
function Blob({ className, style }: { className?: string; style?: MotionStyle }) {
  return (
    <motion.svg viewBox="0 0 600 560" className={className} style={style} aria-hidden>
      <path
        fill="var(--blush)"
        d="M318 18c88 6 178 50 228 128s46 178 4 262-130 140-226 148-196-20-262-90S-4 300 16 214 92 60 168 32s62-20 150-14Z"
      />
    </motion.svg>
  )
}

// `zoom` (wide screens, motion allowed): the hero pins while you scroll, the text and cards drift away, and the
// screenshot grows to the center of the screen. It ends exactly on the product fan's first frame, and the fan
// takes over from there (see ProductFan `handoff`).
// Otherwise (phones, tablets): the text fades and the screenshot grows a little as the hero scrolls away.
export default function Hero({ zoom = false }: { zoom?: boolean }) {
  const reduce = useReducedMotion()
  const live = !reduce
  const sectionRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress: p } = useScroll({
    target: sectionRef,
    offset: zoom ? ['start start', 'end end'] : ['start start', 'end start'],
  })

  // How far the screenshot must move and grow to land on the fan's first frame (measured, in px)
  const dx = useMotionValue(0)
  const dy = useMotionValue(0)
  const grow = useMotionValue(1)

  useLayoutEffect(() => {
    if (!zoom) return
    const stage = stageRef.current
    const grid = gridRef.current
    const box = boxRef.current
    if (!stage || !grid || !box) return
    const measure = () => {
      const s = stage.getBoundingClientRect()
      const b = box.getBoundingClientRect() // the box itself never moves; only the layer inside it does
      const target = fanStartPose(window.innerWidth, window.innerHeight, s.width)
      dx.set(target.cx - (b.left - s.left + b.width / 2))
      dy.set(target.cy - (b.top - s.top + b.height / 2))
      grow.set(target.width / b.width)
    }
    measure()
    // Re-measure on resize and when the text column changes height (fonts loading)
    const ro = new ResizeObserver(measure)
    ro.observe(stage)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [zoom, dx, dy, grow])

  // 0 → 1 over the zoom; held at 1 for the last bit so the handoff isn't rushed
  const t = useTransform(p, [0.08, 0.88], [0, 1], { ease: easeInOut })

  const zoomX = useTransform(() => t.get() * dx.get())
  const zoomY = useTransform(() => t.get() * dy.get())
  const zoomScale = useTransform(() => 1 + t.get() * (grow.get() - 1))
  const softScale = useTransform(p, [0, 1], [1, 1.06])
  const shot: MotionStyle = zoom ? { x: zoomX, y: zoomY, scale: zoomScale } : { scale: softScale }
  const corner = useTransform(t, [0, 1], [20, 0])
  const shotRadius = useTransform(() => `0 0 ${corner.get()}px ${corner.get()}px`)
  const frameOpacity = useTransform(t, [0, 0.9], [1, 0])
  const barOpacity = useTransform(p, [0.05, 0.35], [1, 0])

  const textOpacity = useTransform(p, zoom ? [0, 0.3] : [0, 0.7], [1, 0])
  const textY = useTransform(p, zoom ? [0, 0.35] : [0, 1], [0, zoom ? -110 : -60])
  const text: MotionStyle = { opacity: textOpacity, y: textY }
  const fade = useTransform(p, [0, 0.3], [1, 0])

  // The two floating cards fly off in opposite directions
  const cardOpacity = useTransform(p, [0.03, 0.3], [1, 0])
  const cardX = useTransform(p, [0.03, 0.35], [0, 280])
  const cardXLeft = useTransform(cardX, (v) => -v)
  const cardY = useTransform(p, [0.03, 0.35], [0, 120])
  const cardYUp = useTransform(cardY, (v) => -v)
  const leftCard: MotionStyle = { x: cardXLeft, y: cardY, opacity: cardOpacity }
  const rightCard: MotionStyle = { x: cardX, y: cardYUp, opacity: cardOpacity }

  return (
    <section ref={sectionRef} className={cn('relative', zoom && '-mt-18 h-[180vh]')}>
      <div ref={stageRef} className={cn(zoom && 'sticky top-0 flex h-screen items-center overflow-hidden pt-18')}>
        <div
          ref={gridRef}
          className={cn(
            'mx-auto grid w-full max-w-[1200px] items-center gap-16 px-6 lg:grid-cols-[1fr_1.05fr]',
            !zoom && 'pt-12 pb-[72px] md:pb-[120px] lg:pt-20',
          )}
        >
          <motion.div style={live ? text : undefined}>
            <motion.div variants={stagger(0.1)} initial="hidden" animate="show">
              <motion.p
                variants={rise}
                className="inline-flex items-center gap-2 rounded-full bg-blush px-4 py-1.5 text-sm font-semibold text-primary"
              >
                <span className="size-1.5 rounded-full bg-primary" aria-hidden />
                For Lincoln Financial dental members
              </motion.p>
              <SplitHeading
                as="h1"
                text="Know what you’ll pay *before* you’re in the chair."
                className="mt-6 text-[48px] leading-[0.98] md:text-[72px] xl:text-[80px]"
              />
              <motion.p variants={rise} className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                Molar Money turns your dental plan into plain English, estimates your costs, and plans your care so you get
                the most from your benefits.
              </motion.p>
              <motion.div variants={rise} className="mt-9 flex flex-wrap items-center gap-3">
                <TryDemoButton className="h-14 text-lg" />
                <a
                  href="#how-it-works"
                  className="inline-flex h-13 items-center rounded-full px-6 text-base font-bold text-foreground transition-colors hover:bg-accent"
                >
                  See how it works
                </a>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* The 4:3 box stays put (so it can be measured); the layer inside it moves and grows */}
          <div ref={boxRef} className="relative z-20 mx-auto mt-12 aspect-[4/3] w-full max-w-[600px] lg:max-w-none">
            <Blob
              style={live && zoom ? { opacity: fade } : undefined}
              className="absolute -inset-x-6 -top-24 -bottom-10 h-[calc(100%+8.5rem)] w-[calc(100%+3rem)]"
            />

            <motion.div style={live ? shot : undefined} className="absolute inset-0">
              <motion.figure
                initial={{ opacity: 0, y: 20, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.7, ease, delay: 0.45 }}
                className="relative size-full"
              >
                {/* Soft browser frame: white backing + shadow, fades out as the screenshot fills the screen */}
                <motion.div
                  style={live ? { opacity: frameOpacity } : undefined}
                  className="absolute inset-x-0 -top-12 bottom-0 rounded-[20px] bg-white shadow-[0_30px_60px_-20px_rgba(101,0,48,0.25)]"
                  aria-hidden
                />
                <motion.div
                  style={live ? { opacity: barOpacity } : undefined}
                  className="absolute inset-x-0 bottom-full flex h-12 items-center gap-2 rounded-t-[20px] border-b bg-[var(--soft)] px-4"
                  aria-hidden
                >
                  <span className="size-2.5 rounded-full bg-[var(--line)]" />
                  <span className="size-2.5 rounded-full bg-[var(--line)]" />
                  <span className="size-2.5 rounded-full bg-[var(--line)]" />
                  <span className="ml-3 h-6 flex-1 rounded-full bg-white px-3 text-[11px] leading-6 text-muted-foreground">
                    molarmoney.app/coverage
                  </span>
                </motion.div>
                <motion.div
                  style={{ borderRadius: live ? shotRadius : '0 0 20px 20px' }}
                  className="relative size-full overflow-hidden bg-white"
                >
                  <img
                    src={screens.coverage.src}
                    srcSet={screens.coverage.srcSet}
                    sizes={SCREEN_SIZES}
                    alt={screens.coverage.alt}
                    width={SCREEN_W}
                    height={SCREEN_H}
                    fetchPriority="high"
                    className="size-full object-cover object-top"
                  />
                </motion.div>
              </motion.figure>
            </motion.div>

            {/* Golden numbers: filling with the deductible met; crown now ($800) vs after Jan 1 ($625).
                Sits on the screenshot's bottom-left corner: half on it, half hanging off, solid white on top. */}
            <motion.div style={live && zoom ? leftCard : undefined} className="absolute -bottom-12 -left-3 z-30 sm:-left-12">
              <FloatingCard
                delay={0.9}
                drift={0}
                className="relative w-48"
                cardClassName="bg-white p-4 ring-1 ring-black/5 shadow-[0_24px_48px_-12px_rgba(28,28,30,0.35)]"
              >
                <p className="text-xs font-semibold text-muted-foreground">Filling · back tooth</p>
                <p className="mt-1 text-xs font-bold tracking-wide text-muted-foreground uppercase">You pay</p>
                <p className="money text-[34px] text-primary">$40</p>
                <div className="mt-2 flex h-2 overflow-hidden rounded-full" aria-hidden>
                  <span className="w-4/5 bg-primary" />
                  <span className="w-1/5 bg-[var(--track)]" />
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">Plan pays $160</p>
              </FloatingCard>
            </motion.div>

            <motion.div style={live && zoom ? rightCard : undefined} className="absolute -top-20 -right-3 z-30 sm:-right-8">
              <FloatingCard delay={1.05} drift={1.5} className="relative" cardClassName="bg-peach p-3 pr-5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white text-savings-ink"
                    aria-hidden
                  >
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
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}
