import { Fragment } from 'react'
import { motion } from 'motion/react'
import { ease, stagger } from '@/lib/motion'

const word = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { duration: 0.9, ease } },
}

// Headline whose words slide up from behind a mask, one after another (Oscar-style).
// Wrap a word in *asterisks* to set it in italic, e.g. "Know what you'll pay *before* you're in the chair."
// Uses variants, so it follows its parent's hidden/show state (Reveal, or the hero's stagger).
export default function SplitHeading({
  as = 'h2',
  text,
  className,
  gap = 0.05,
}: {
  as?: 'h1' | 'h2'
  text: string
  className?: string
  gap?: number
}) {
  const Tag = as === 'h1' ? motion.h1 : motion.h2
  // Track *italic* runs across spaces so "*fine print*" works too
  let inItalic = false
  const words = text.split(' ').map((w) => {
    const starts = w.startsWith('*')
    const ends = w.endsWith('*') && w.length > 1
    const italic = inItalic || starts
    if (starts) inItalic = true
    if (ends) inItalic = false
    return { label: w.replace(/\*/g, ''), italic }
  })
  return (
    <Tag variants={stagger(gap)} aria-label={text.replace(/\*/g, '')} className={className}>
      {words.map(({ label, italic }, i) => (
          <Fragment key={i}>
            {/* Extra room below and to the right so italic tails and descenders aren't clipped by the mask */}
            <span aria-hidden className="-mb-[0.14em] -mr-[0.08em] inline-block overflow-hidden pr-[0.08em] pb-[0.14em] align-bottom">
              <motion.span variants={word} className="inline-block">
                {italic ? <em>{label}</em> : label}
              </motion.span>
            </span>
            {i < words.length - 1 && ' '}
          </Fragment>
      ))}
    </Tag>
  )
}
