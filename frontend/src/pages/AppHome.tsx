import { Link } from 'react-router'
import { UserButton, useClerk, useUser } from '@clerk/react'
import Logo from '@/components/Logo'

// Signed-in home. Placeholder until the app screens (My Coverage, Estimate, Plan My Year) are built.
export default function AppHome() {
  const { user } = useUser()
  const { signOut } = useClerk()
  return (
    <div className="flex min-h-screen flex-col bg-blush">
      <header className="mx-auto flex h-18 w-full max-w-[1200px] items-center justify-between px-6">
        <Link to="/" aria-label="bitewise home">
          <Logo />
        </Link>
        <UserButton />
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-18 text-center">
        <h1 className="text-[48px] leading-tight">
          Hi{user?.firstName ? <>, <em>{user.firstName}</em></> : ' there'}
        </h1>
        <p className="max-w-sm text-lg text-muted-foreground">Your coverage, estimates, and year plan are coming here next.</p>
        <button
          type="button"
          onClick={() => signOut({ redirectUrl: '/' })}
          className="inline-flex h-12 items-center rounded-full bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90"
        >
          Log out
        </button>
      </main>
    </div>
  )
}
