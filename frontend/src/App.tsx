import { Route, Routes } from 'react-router'
import RequireAuth from '@/components/auth/RequireAuth'
import AppHome from '@/pages/AppHome'
import Landing from '@/pages/Landing'
import Login from '@/pages/Login'
import Signup from '@/pages/Signup'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      {/* Wildcard: Clerk moves through sub-steps like /login/factor-one and /signup/verify-email-address */}
      <Route path="/login/*" element={<Login />} />
      <Route path="/signup/*" element={<Signup />} />
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppHome />
          </RequireAuth>
        }
      />
    </Routes>
  )
}
