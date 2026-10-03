import { Info } from 'lucide-react'

export const DISCLAIMER_TEXT =
  "This is an estimate, not a guarantee. Your actual cost depends on your dentist's charges and claim review."

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <p
      role="note"
      className={`flex items-start gap-2 rounded-lg border border-dashed bg-muted/50 px-3 py-2 text-xs text-muted-foreground ${className}`}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{DISCLAIMER_TEXT}</span>
    </p>
  )
}
