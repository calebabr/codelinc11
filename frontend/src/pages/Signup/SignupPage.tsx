// Create an account with Clerk. Clerk moves through sub-steps under /signup/* (for example the email code).

import { SignUp } from '@clerk/react'
import AuthLayout from '@/components/auth/AuthLayout'
import { embeddedForm } from '@/components/auth/clerk-appearance'

export default function SignupPage() {
  return (
    <AuthLayout title="Create your account" subtitle="It takes a minute. Then pick your profile and we’ll do the math.">
      <SignUp routing="path" path="/signup" signInUrl="/login" appearance={embeddedForm} />
    </AuthLayout>
  )
}
