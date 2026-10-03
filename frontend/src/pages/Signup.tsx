import { SignUp } from '@clerk/react'
import AuthLayout from '@/components/auth/AuthLayout'
import { embeddedForm } from '@/components/auth/clerk-appearance'

export default function Signup() {
  return (
    <AuthLayout title="Create your account" subtitle="It takes a minute. Then pick your plan and we’ll do the math.">
      <SignUp routing="path" path="/signup" signInUrl="/login" appearance={embeddedForm} />
    </AuthLayout>
  )
}
