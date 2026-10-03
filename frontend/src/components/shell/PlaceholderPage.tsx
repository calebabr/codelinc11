import type { ReactNode } from "react"

// Shared placeholder for pages that later tasks (T07-T12) will build.
export function PlaceholderPage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div>
      <h1 className="font-heading text-3xl font-semibold text-burgundy">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-[var(--line)] bg-white p-8 text-sm text-[var(--muted)]">
        {children ?? "Nothing here yet. This page is being built."}
      </div>
    </div>
  )
}
