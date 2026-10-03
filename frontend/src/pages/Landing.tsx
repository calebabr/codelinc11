import FinalCta from '@/components/landing/FinalCta'
import Footer from '@/components/landing/Footer'
import Hero from '@/components/landing/Hero'
import HowItWorks from '@/components/landing/HowItWorks'
import Nav from '@/components/landing/Nav'
import PlainEnglish from '@/components/landing/PlainEnglish'
import SavingsMoment from '@/components/landing/SavingsMoment'

export default function Landing() {
  return (
    <div className="min-h-screen overflow-x-clip">
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <SavingsMoment />
        <PlainEnglish />
        <FinalCta />
      </main>
      <Footer />
    </div>
  )
}
