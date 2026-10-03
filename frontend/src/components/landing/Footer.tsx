import { Link } from 'react-router'
import Logo from '@/components/Logo'

export default function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <Logo />
          <p className="text-sm text-muted-foreground">Built for codeLinc 11 with Lincoln Financial</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground">
          <a href="#how-it-works" className="hover:text-foreground">
            How it works
          </a>
          <Link to="/login" className="hover:text-foreground">
            Log in
          </Link>
          <Link to="/login" className="hover:text-foreground">
            Get started
          </Link>
        </nav>
      </div>
      <p className="mx-auto max-w-[1200px] px-6 pb-8 text-xs text-muted-foreground">
        Estimates, not guarantees. Your actual cost depends on your dentist's charges and claim review.
      </p>
    </footer>
  )
}
