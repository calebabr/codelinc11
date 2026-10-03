import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Visual reference for the theme. Not part of the product: open /style to check the look.
// All dollar figures here are static sample text (golden scenario G3), not calculations.

const swatches = [
  { name: 'Paper', className: 'bg-background border', hex: '#FAF7F2' },
  { name: 'Card', className: 'bg-card border', hex: '#FFFDF9' },
  { name: 'Ink', className: 'bg-foreground', hex: '#1F1A17' },
  { name: 'Maroon', className: 'bg-primary', hex: '#6B0F2A' },
  { name: 'Orange (savings)', className: 'bg-savings', hex: '#F5591F' },
  { name: 'Muted', className: 'bg-muted', hex: '#F1EBE3' },
]

const receipt = [
  { label: 'Typical cost of a crown', amount: '$1,200.00' },
  { label: 'Plan pays 50% after your $50 deductible', amount: '−$575.00' },
  { label: 'Over your annual max ($400 left)', amount: '+$175.00' },
]

export default function StyleGuide() {
  return (
    <div className="space-y-16">
      <section className="space-y-3">
        <p className="eyebrow">Style guide</p>
        <h1 className="text-5xl">Your dental benefits, in plain English.</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Warm paper, ink text, Lincoln maroon. Orange is used only for money you save.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Colors</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {swatches.map((s) => (
            <div key={s.name} className="space-y-2">
              <div className={`h-16 rounded-md ${s.className}`} />
              <p className="text-sm font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.hex}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Type</h2>
        <h1 className="text-5xl">Heading 1, Fraunces</h1>
        <h2 className="text-3xl">Heading 2, Fraunces</h2>
        <h3 className="text-xl">Heading 3, Fraunces</h3>
        <p className="max-w-xl">
          Body text, Geist. Crowns count as major work, which your plan covers at 50% after the deductible.
        </p>
        <p className="text-sm text-muted-foreground">Secondary text for notes and explanations.</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Numbers</h2>
        <div className="flex flex-wrap items-end gap-12">
          <div className="space-y-2">
            <p className="eyebrow">You pay</p>
            <p className="money text-7xl text-primary">$800</p>
          </div>
          <div className="space-y-2">
            <p className="eyebrow">Plan pays</p>
            <p className="money text-4xl">$400</p>
          </div>
          <div className="space-y-2">
            <p className="eyebrow">You save</p>
            <p className="money text-5xl text-savings">$895</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Estimate receipt</h2>
        <div className="max-w-md rounded-md border bg-card p-6 shadow-sm">
          <p className="eyebrow">Estimate · Crown (D2740)</p>
          <dl className="mt-4 divide-y divide-dashed">
            {receipt.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="money">{r.amount}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex items-end justify-between border-t-2 border-foreground pt-4">
            <span className="font-medium">You pay</span>
            <span className="money text-4xl text-primary">$800.00</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This is an estimate. Your actual cost depends on your dentist's charges and claim review.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Controls</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Plan my year</Button>
          <Button variant="outline">See the original wording</Button>
          <Button variant="ghost">Cancel</Button>
          <Badge>Preventive · 100%</Badge>
          <Badge variant="secondary">Basic · 80%</Badge>
          <Badge variant="outline">Major · 50%</Badge>
        </div>
      </section>
    </div>
  )
}
