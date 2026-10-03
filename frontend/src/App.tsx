import { NavLink, Route, Routes } from 'react-router'
import GetStarted from '@/pages/GetStarted'
import Home from '@/pages/Home'
import Coverage from '@/pages/Coverage'
import Estimate from '@/pages/Estimate'
import PlanYear from '@/pages/PlanYear'

const links = [
  { to: '/', label: 'Home' },
  { to: '/coverage', label: 'My Coverage' },
  { to: '/estimate', label: 'Estimate' },
  { to: '/plan-year', label: 'Plan My Year' },
  { to: '/get-started', label: 'Get started' },
]

export default function App() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2">
        <span className="text-lg font-semibold">Hackathon Temp</span>
        <nav className="flex flex-wrap gap-4">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end
              className={({ isActive }) => (isActive ? 'font-semibold underline' : 'text-muted-foreground')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/coverage" element={<Coverage />} />
        <Route path="/estimate" element={<Estimate />} />
        <Route path="/plan-year" element={<PlanYear />} />
        <Route path="/get-started" element={<GetStarted />} />
      </Routes>
    </div>
  )
}
