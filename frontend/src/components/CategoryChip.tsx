import type { Category } from '@/lib/types'

export const CATEGORY_STYLES: Record<Category, string> = {
  preventive: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  basic: 'bg-sky-100 text-sky-900 border-sky-300',
  major: 'bg-amber-100 text-amber-900 border-amber-300',
}

export const CATEGORY_LABEL: Record<Category, string> = {
  preventive: 'Preventive',
  basic: 'Basic',
  major: 'Major',
}

export function CategoryChip({ category }: { category: Category }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category]}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  )
}
