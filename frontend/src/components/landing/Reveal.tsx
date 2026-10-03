import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import { stagger } from '@/lib/motion'

// Rises + fades in when scrolled into view (once). Children marked with `variants={rise}` reveal one by one.
export default function Reveal({ children, className, gap = 0.1 }: { children: ReactNode; className?: string; gap?: number }) {
  return (
    <motion.div
      variants={stagger(gap)}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.25 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
