import { useQuery } from '@tanstack/react-query'
import { Crown, Smile, Wrench } from 'lucide-react'
import type { ComponentType } from 'react'
import { CATEGORY_LABEL, CATEGORY_STYLES } from '@/components/CategoryChip'
import { ErrorState, Skeleton } from '@/components/StateViews'
import { searchProcedures } from '@/lib/api'
import { money } from '@/lib/format'
import type { Category, Procedure } from '@/lib/types'

export function useCatalog() {
  const q = useQuery({ queryKey: ['procedures', ''], queryFn: () => searchProcedures('') })
  return { ...q, procedures: q.data?.map((m) => m.procedure) ?? [] }
}

const ICONS: Record<Category, ComponentType<{ className?: string }>> = {
  preventive: Smile,
  basic: Wrench,
  major: Crown,
}
const ORDER: Category[] = ['preventive', 'basic', 'major']

/** Grid of tappable procedure cards grouped by category. */
export function ProcedureGrid({
  procedures,
  loading,
  error,
  onRetry,
  onPick,
  selectedCode,
  verb = 'Choose',
}: {
  procedures: Procedure[]
  loading?: boolean
  error?: unknown
  onRetry?: () => void
  onPick: (p: Procedure) => void
  selectedCode?: string | null
  verb?: string
}) {
  if (loading)
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="status" aria-label="Loading procedures">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  if (error) return <ErrorState error={error} onRetry={onRetry} />
  return (
    <div className="space-y-4">
      {ORDER.map((cat) => {
        const list = procedures.filter((p) => p.category === cat)
        if (list.length === 0) return null
        const Icon = ICONS[cat]
        return (
          <section key={cat} aria-label={`${CATEGORY_LABEL[cat]} procedures`} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">{CATEGORY_LABEL[cat]} care</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((p) => (
                <button
                  key={p.code}
                  type="button"
                  aria-label={`${verb} ${p.name}`}
                  aria-pressed={selectedCode === p.code}
                  onClick={() => onPick(p)}
                  className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-all hover:-translate-y-0.5 hover:shadow-md ${CATEGORY_STYLES[cat]} ${
                    selectedCode === p.code ? 'ring-2 ring-brand ring-offset-1' : ''
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  <span className="text-sm leading-tight font-semibold">{p.name}</span>
                  <span className="text-xs opacity-80">Typically {money(p.fee_p50)}</span>
                </button>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
