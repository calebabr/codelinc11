import { NavLink, Route, Routes } from 'react-router'
import { cn } from '@/lib/utils'
import GetStarted from '@/pages/GetStarted'
import Home from '@/pages/Home'
import Coverage from '@/pages/Coverage'
import Estimate from '@/pages/Estimate'
import PlanYear from '@/pages/PlanYear'
import StyleGuide from '@/pages/StyleGuide'

const links = [
  { to: '/', label: 'Home' },
  { to: '/coverage', label: 'My Coverage' },
  { to: '/estimate', label: 'Estimate' },
  { to: '/plan-year', label: 'Plan My Year' },
]

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between sm:py-4">
          <NavLink to="/" className="flex items-center gap-2">
            <span className="size-3 rounded-full bg-primary" aria-hidden />
            <span className="font-heading text-xl font-semibold tracking-tight">Hackathon Temp</span>
          </NavLink>

          <nav className="-mx-4 flex gap-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end
                className={({ isActive }) =>
                  cn(
                    'shrink-0 border-b-2 pb-3 text-sm font-medium transition-colors sm:pb-1',
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/coverage" element={<Coverage />} />
          <Route path="/estimate" element={<Estimate />} />
          <Route path="/plan-year" element={<PlanYear />} />
          <Route path="/get-started" element={<GetStarted />} />
          <Route path="/style" element={<StyleGuide />} />
        </Routes>
      </main>
    </div>
  )
}
