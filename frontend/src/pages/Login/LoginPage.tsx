// Real sign-in with Clerk (decision D2). After signing in, the person picks their household
// profile on /choose-profile. Clerk moves through sub-steps under /login/*.

import { SignIn } from '@clerk/react'
import AuthLayout from '@/components/auth/AuthLayout'
import { embeddedForm } from '@/components/auth/clerk-appearance'

export default function LoginPage() {
  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to see your family’s dental plan.">
      <SignIn routing="path" path="/login" signUpUrl="/signup" appearance={embeddedForm} />
    </AuthLayout>
  )
}
