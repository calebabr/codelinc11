import { HelpCircle } from 'lucide-react'

export function UnmatchedPanel({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <section
      aria-labelledby="unmatched-title"
      className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4"
    >
      <h2 id="unmatched-title" className="flex items-center gap-2 text-base font-semibold text-amber-950">
        <HelpCircle className="size-4" aria-hidden="true" />
        We couldn't read these lines
      </h2>
      <p className="text-sm text-amber-900">
        These weren't matched to a procedure, so they're left out of the plan. Ask your dentist's office what they are.
      </p>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="rounded-md bg-white/70 px-2 py-1 font-mono text-xs break-words">
            {l}
          </li>
        ))}
      </ul>
    </section>
  )
}
