import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import { motion } from 'motion/react'
import { LogoMark } from '@/components/Logo'
import Reveal from '@/components/landing/Reveal'
import SplitHeading from '@/components/landing/SplitHeading'
import { rise } from '@/lib/motion'

export default function FinalCta() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 pb-[72px] md:pb-[120px]">
      <Reveal>
        <motion.div
          variants={rise}
          className="hero-banner relative overflow-hidden rounded-[32px] px-8 py-16 text-center md:px-16 md:py-24"
        >
          <LogoMark className="pointer-events-none absolute -right-10 -bottom-16 size-80 text-white/[0.06]" />
          <SplitHeading
            text="Your smile, minus the *surprise* bills."
            className="relative mx-auto max-w-3xl text-[44px] leading-[1] text-white md:text-[72px]"
          />
          <Link
            to="/login"
            className="relative mt-10 inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-8 text-base font-bold text-primary transition-colors hover:bg-blush"
          >
            Get started
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </motion.div>
      </Reveal>
    </section>
  )
}
