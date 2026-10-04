import { LogoMark } from "@/components/Logo"

// Small branded loading state shown while a page's code downloads.
export function PageLoading() {
  return (
    <div role="status" className="flex min-h-[40dvh] flex-col items-center justify-center gap-3 p-8 text-burgundy">
      <LogoMark className="size-10 animate-pulse" />
      <p className="text-sm font-semibold">Loading…</p>
    </div>
  )
}
