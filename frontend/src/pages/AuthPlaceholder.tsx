import { Link } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import Logo from '@/components/Logo'

// Temporary stand-in until the real login/signup (with Duo 2FA) is built.
export default function AuthPlaceholder({ mode }: { mode: 'login' | 'signup' }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-blush px-6 text-center">
      <Link to="/" aria-label="bitewise home">
        <Logo />
      </Link>
      <h1 className="text-[40px] leading-tight">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="max-w-sm text-muted-foreground">
        {mode === 'login' ? 'Log in' : 'Sign up'} is on its way. For now, head back and take a look around.
      </p>
      <Link to="/" className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 font-bold text-primary-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Back to home
      </Link>
    </div>
  )
}
