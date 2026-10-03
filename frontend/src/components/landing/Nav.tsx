import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import Logo from '@/components/Logo'
import { cn } from '@/lib/utils'

// Sticky top bar. Transparent at the top of the page, white blur once you scroll.
export default function Nav() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-[background-color,box-shadow,backdrop-filter] duration-300',
        scrolled ? 'bg-white/80 shadow-[0_1px_0_var(--border)] backdrop-blur-md' : 'bg-transparent',
      )}
    >
      <nav className="mx-auto flex h-18 max-w-[1200px] items-center justify-between px-6" aria-label="Main">
        <Link to="/" aria-label="bitewise home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="#how-it-works" className="text-[15px] font-semibold text-muted-foreground hover:text-foreground">
            How it works
          </a>
          <Link to="/login" className="text-[15px] font-semibold text-foreground hover:text-primary">
            Log in
          </Link>
          <Link
            to="/signup"
            className="inline-flex h-11 items-center rounded-full bg-primary px-6 text-[15px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Get started
          </Link>
        </div>

        {/* Small screens: links in a slide-out panel */}
        <Sheet>
          <SheetTrigger
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-accent md:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </SheetTrigger>
          <SheetContent side="right" className="w-72 p-6">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Logo />
            <div className="mt-8 flex flex-col gap-2">
              <a href="#how-it-works" className="rounded-xl px-3 py-3 text-base font-semibold hover:bg-accent">
                How it works
              </a>
              <Link to="/login" className="rounded-xl px-3 py-3 text-base font-semibold hover:bg-accent">
                Log in
              </Link>
              <Link
                to="/signup"
                className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground"
              >
                Get started
              </Link>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  )
}
