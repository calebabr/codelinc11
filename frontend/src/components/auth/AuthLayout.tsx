import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import Logo, { LogoMark } from '@/components/Logo'
import { screens } from '@/components/landing/screens'
import { rise, stagger } from '@/lib/motion'

// Form on the left; a burgundy brand panel with the product on the right (wide screens only)
export default function AuthLayout({ title, subtitle, children }: { title: ReactNode; subtitle: ReactNode; children: ReactNode }) {
  return (
    <div className="landing grid min-h-dvh bg-background lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-6 py-6 md:px-12">
        <Link to="/welcome" aria-label="Molar Money home" className="self-start">
          <Logo />
        </Link>

        <motion.main
          variants={stagger(0.08)}
          initial="hidden"
          animate="show"
          className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12"
        >
          <motion.h1 variants={rise} className="text-[44px] leading-[1] md:text-[52px]">
            {title}
          </motion.h1>
          <motion.p variants={rise} className="mt-3 text-lg text-muted-foreground">
            {subtitle}
          </motion.p>
          <motion.div variants={rise} className="mt-8">
            {children}
          </motion.div>
        </motion.main>
      </div>

      <aside className="relative m-4 hidden overflow-hidden rounded-[32px] bg-primary lg:block" aria-hidden>
        <LogoMark className="absolute -top-16 -right-16 size-80 text-white/[0.06]" />
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative px-14 pt-20"
        >
          <p className="max-w-md font-display text-[44px] leading-[1.05] text-white" style={{ letterSpacing: '-0.025em' }}>
            Your dental plan, in <em>plain English.</em>
          </p>
          <p className="mt-4 max-w-sm text-lg text-white/75">See what’s covered, what you’ll owe, and when to go.</p>
        </motion.div>
        <motion.img
          src={screens.coverage.src}
          srcSet={screens.coverage.srcSet}
          sizes="50vw"
          loading="lazy"
          alt=""
          initial={{ opacity: 0, y: 60, rotate: -2 }}
          animate={{ opacity: 1, y: 0, rotate: -4 }}
          transition={{ duration: 1, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="absolute -right-10 -bottom-24 w-[88%] rounded-[24px] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.45)]"
        />
      </aside>
    </div>
  )
}
