import { useRef, type CSSProperties } from 'react'
import { motion, useReducedMotion, useScroll, useTransform, type MotionStyle } from 'motion/react'
import { FAN_CARD_WIDTH as CARD_WIDTH, FAN_START_SCALE, SCREEN_H, SCREEN_SIZES, SCREEN_W, screens } from '@/components/landing/screens'
import { useViewportWidth } from '@/lib/use-viewport-width'
import { cn } from '@/lib/utils'

const CAPTION = 'One plan, three questions answered: what’s covered, what you’ll owe, and when to go.'

// Final state (end of the scroll). Radii are divided by the scale so the corners *look* 28px.
const CENTER_END = { scale: 0.72, radius: 28 / 0.72 }
const SIDE_END = { scale: 0.62, radius: 28 / 0.62, rotate: 6 }
const SHADOW_OFF = '0 40px 80px -30px rgba(101,0,48, 0)'
const SHADOW_ON = '0 40px 80px -30px rgba(101,0,48, 0.35)'

// How far the side cards slide out: 340px on wide screens, less on tablets
function sideOffset(vw: number) {
  return Math.min(340, vw * 0.26)
}

function Screen({ screen, style, className }: { screen: keyof typeof screens; style: MotionStyle; className?: string }) {
  const { src, srcSet, alt } = screens[screen]
  return (
    <motion.div
      style={{ width: CARD_WIDTH, ...style }}
      className={cn('absolute aspect-[4/3] overflow-hidden bg-white', className)}
    >
      <img src={src} srcSet={srcSet} sizes={SCREEN_SIZES} alt={alt} width={SCREEN_W} height={SCREEN_H} decoding="async" className="size-full object-cover object-top" />
    </motion.div>
  )
}

// The three cards and the caption, laid out in one screen-tall stage. Styles can be fixed values or scroll-linked.
function Stage({
  center,
  left,
  right,
  caption,
  className = 'h-screen',
}: {
  center: MotionStyle
  left?: MotionStyle
  right?: MotionStyle
  caption: MotionStyle
  className?: string
}) {
  return (
    <div className={cn('relative flex items-center justify-center overflow-hidden', className)}>
      {/* Cards sit a little above the middle so the caption fits below */}
      <div className="relative flex -translate-y-[6vh] items-center justify-center" style={{ width: CARD_WIDTH } as CSSProperties}>
        <div className="invisible aspect-[4/3] w-full" aria-hidden />
        {left && <Screen screen="estimate" style={left} className="z-10" />}
        {right && <Screen screen="plan" style={right} className="z-10" />}
        <Screen screen="coverage" style={center} className="z-20" />
      </div>
      <motion.p
        style={caption}
        className="absolute inset-x-6 bottom-[9vh] mx-auto max-w-2xl text-center font-display text-[24px] leading-snug text-foreground md:text-[30px]"
      >
        {CAPTION}
      </motion.p>
    </div>
  )
}

function ScrollFan({ desktop, handoff }: { desktop: boolean; handoff: boolean }) {
  const ref = useRef<HTMLElement>(null)
  const offset = sideOffset(useViewportWidth())
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  const centerEnd = desktop ? CENTER_END : { scale: 0.9, radius: 20 / 0.9 }
  const center = {
    scale: useTransform(p, [0, 0.5], [desktop ? FAN_START_SCALE : 1, centerEnd.scale]),
    borderRadius: useTransform(p, [0, 0.5], [0, centerEnd.radius]),
    boxShadow: useTransform(p, [0, 0.5], [SHADOW_OFF, SHADOW_ON]),
  }

  // Side cards slide out from behind the center card
  const sideScale = useTransform(p, [0.25, 0.6], [0.8, SIDE_END.scale])
  const sideOpacity = useTransform(p, [0.25, 0.6], [0, 1])
  const leftX = useTransform(p, [0.25, 0.6], [0, -offset])
  const rightX = useTransform(p, [0.25, 0.6], [0, offset])
  const leftRotate = useTransform(p, [0.25, 0.6], [0, -SIDE_END.rotate])
  const rightRotate = useTransform(p, [0.25, 0.6], [0, SIDE_END.rotate])
  const side = { scale: sideScale, opacity: sideOpacity, borderRadius: SIDE_END.radius, boxShadow: SHADOW_ON }

  // Handoff: stay hidden while sliding up under the hero, show on the exact frame this section pins
  const { scrollYProgress: arrive } = useScroll({ target: ref, offset: ['start end', 'start start'] })
  const visibility = useTransform(arrive, (v) => (!handoff || v > 0.999 ? 'visible' : 'hidden'))

  const caption = {
    opacity: useTransform(p, [0.55, 0.75], [0, 1]),
    y: useTransform(p, [0.55, 0.75], [24, 0]),
  }

  return (
    <section
      ref={ref}
      aria-label="The Molar Money app"
      className={cn(
        'relative overflow-x-clip',
        desktop ? 'h-[250vh]' : 'h-[160vh]',
        // Handoff: slide up under the hero's last pinned screen so the zoomed screenshot becomes this card with no seam
        handoff && 'z-10 -mt-[100vh]',
      )}
    >
      <motion.div style={{ visibility }} className={cn('sticky top-0 h-screen', handoff && 'bg-background')}>
        <Stage
          center={center}
          left={desktop ? { ...side, x: leftX, rotate: leftRotate } : undefined}
          right={desktop ? { ...side, x: rightX, rotate: rightRotate } : undefined}
          caption={caption}
        />
      </motion.div>
    </section>
  )
}

// Reduce Motion: no sticky, no scroll link, just the finished fan
function StaticFan({ desktop }: { desktop: boolean }) {
  const offset = sideOffset(useViewportWidth())
  const centerEnd = desktop ? CENTER_END : { scale: 0.9, radius: 20 / 0.9 }
  const side = { scale: SIDE_END.scale, borderRadius: SIDE_END.radius, boxShadow: SHADOW_ON }
  return (
    <section aria-label="The Molar Money app" className="relative overflow-x-clip">
      <Stage
        center={{ scale: centerEnd.scale, borderRadius: centerEnd.radius, boxShadow: SHADOW_ON }}
        left={desktop ? { ...side, x: -offset, rotate: -SIDE_END.rotate } : undefined}
        right={desktop ? { ...side, x: offset, rotate: SIDE_END.rotate } : undefined}
        caption={{}}
        className={desktop ? 'h-screen' : 'h-[70svh] min-h-[420px]'}
      />
    </section>
  )
}

// Right after the hero: the Coverage screen shrinks into a card while Estimate and Plan My Year fan out beside it.
// `handoff`: the hero's zoom ends on this section's first frame, so start pinned on top of it.
export default function ProductFan({ handoff = false }: { handoff?: boolean }) {
  const desktop = useViewportWidth() >= 768
  const reduce = useReducedMotion()
  // Phones get the finished fan with no scroll animation (cheaper and no jumpy pinned section).
  return reduce || !desktop ? <StaticFan desktop={desktop} /> : <ScrollFan desktop={desktop} handoff={handoff} />
}
