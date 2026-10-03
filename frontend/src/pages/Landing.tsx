import { useReducedMotion } from 'motion/react'
import FinalCta from '@/components/landing/FinalCta'
import Footer from '@/components/landing/Footer'
import Hero from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'
import Nav from '@/components/landing/Nav'
import ProductFan from '@/components/landing/ProductFan'
import PlainEnglish from '@/components/landing/PlainEnglish'
import SavingsMoment from '@/components/landing/SavingsMoment'
import { useViewportWidth } from '@/lib/use-viewport-width'

export default function Landing() {
  // Wide screens with motion allowed: the hero's screenshot zooms straight into the product fan
  const wide = useViewportWidth() >= 1024
  const reduce = useReducedMotion()
  const zoom = wide && !reduce
  return (
    <div className="landing min-h-screen overflow-x-clip bg-white">
      <Nav />
      <main>
        {/* key: remount when the layout mode flips, so the scroll tracking restarts cleanly */}
        <Hero key={`hero-${zoom}`} zoom={zoom} />
        <ProductFan key={`fan-${zoom}`} handoff={zoom} />
        <HowItWorks />
        <SavingsMoment />
        <PlainEnglish />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
