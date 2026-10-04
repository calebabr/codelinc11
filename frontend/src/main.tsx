import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { MotionConfig } from 'motion/react'
import './index.css'
import App from './App.tsx'
import AuthProvider from '@/state/AuthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* "user": skip movement for people who turned on Reduce Motion */}
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
