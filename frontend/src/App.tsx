import { Route, Routes } from 'react-router'
import Landing from '@/pages/Landing'
import AuthPlaceholder from '@/pages/AuthPlaceholder'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPlaceholder mode="login" />} />
      <Route path="/signup" element={<AuthPlaceholder mode="signup" />} />
    </Routes>
  )
}
