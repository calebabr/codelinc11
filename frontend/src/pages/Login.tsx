import { SignIn } from '@clerk/react'
import AuthLayout from '@/components/auth/AuthLayout'
import { embeddedForm } from '@/components/auth/clerk-appearance'

export default function Login() {
  return (
    <AuthLayout title="Welcome back" subtitle="Log in to see your plan and plan your care.">
      <SignIn routing="path" path="/login" signUpUrl="/signup" appearance={embeddedForm} />
    </AuthLayout>
  )
}
