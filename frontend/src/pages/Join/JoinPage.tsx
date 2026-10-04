import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import QRCode from 'qrcode'
import Logo from '@/components/Logo'

// Returns the URL if it is a valid http or https address, otherwise null.
export function safeHttpUrl(value: string | null): string | null {
  if (!value) return null
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

// Public big-screen page: a QR code that opens the app on a phone. Generated in the browser, so the address never leaves it.
export default function JoinPage() {
  const [params] = useSearchParams()
  const target = safeHttpUrl(params.get('url')) ?? `${window.location.origin}/welcome`
  const [svg, setSvg] = useState('')
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null)

  useEffect(() => {
    let live = true
    QRCode.toString(target, { type: 'svg', margin: 4, errorCorrectionLevel: 'M', color: { dark: '#1c1c1e', light: '#ffffff' } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(''))
    return () => {
      live = false
    }
  }, [target])

  async function copy() {
    try {
      await navigator.clipboard.writeText(target)
      setCopied('yes')
    } catch {
      setCopied('no')
    }
  }

  return (
    <main className="min-h-dvh bg-white text-ink">
      <div className="wrap flex flex-col items-center gap-6 py-10 text-center">
        <Logo />
        <h1 className="text-3xl font-bold text-burgundy sm:text-5xl">Scan to try Molar Money</h1>
        <p className="text-lg text-muted-foreground">Scan with your phone's camera to try it.</p>
        <div
          role="img"
          aria-label={`QR code for ${target}`}
          data-testid="qr"
          className="w-full max-w-[min(90vw,480px)] min-w-[min(100%,320px)] rounded-[18px] border border-line bg-white p-2 [&>svg]:h-auto [&>svg]:w-full"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <p className="break-all text-xl font-semibold text-burgundy" data-testid="join-address">
          {target}
        </p>
        <button type="button" className="btn btn-orange" onClick={copy}>
          Copy link
        </button>
        <p role="status" className="min-h-6 text-sm text-muted-foreground">
          {copied === 'yes' ? 'Link copied.' : copied === 'no' ? 'Could not copy. Select the address above instead.' : ''}
        </p>
        <p className="note max-w-xl text-left">
          Each visitor gets their own demo family, so you can explore without affecting anyone else.
        </p>
        <p className="text-sm text-muted-foreground">This is an estimate, not a guarantee. Demo data only.</p>
      </div>
    </main>
  )
}
