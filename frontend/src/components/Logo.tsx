import { cn } from '@/lib/utils'

// The Molar Money tooth mark. Color comes from currentColor (burgundy by default via text-primary).
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M14 6C9 6 6 10 6 16C6 22 8 26 10 30L12 40C12.6 43 16.4 43 17 40L19 31C19.5 29 21.8 28 24 28C26.2 28 28.5 29 29 31L31 40C31.6 43 35.4 43 36 40L38 30C40 26 42 22 42 16C42 10 39 6 34 6C30 6 27.5 8 24 8C20.5 8 18 6 14 6Z M20 15.5a3 3 0 1 0-6 0a3 3 0 1 0 6 0Z"
      />
    </svg>
  )
}

// Mark + lowercase wordmark. `inverted` for dark backgrounds.
export default function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={cn('size-8', inverted ? 'text-white' : 'text-primary')} />
      <span
        className={cn('font-heading text-[26px] leading-none font-bold', inverted ? 'text-white' : 'text-foreground')}
        style={{ letterSpacing: '-0.04em' }}
      >
        Molar Money
      </span>
    </span>
  )
}
