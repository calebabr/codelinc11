import type { Transition, Variants } from 'motion/react'

// One feel everywhere: calm, quick, never bouncy.
export const ease = [0.22, 1, 0.36, 1] as const
export const transition: Transition = { duration: 0.7, ease }

// Fade in while rising 20px
export const rise: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition },
}

// Parent that reveals its children one after another
export function stagger(gap = 0.1, delay = 0): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: gap, delayChildren: delay } } }
}
