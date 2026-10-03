// Visual reference for the portal look (decision D5). Not part of the product: open /style to check the look.
// All dollar figures here are static sample text (golden scenarios G3 and S2), not calculations.
// Rules and contrast notes: docs/design/portal-look.md

const swatches = [
  { name: 'burgundy', hex: '#650030', bg: 'bg-burgundy', note: 'Brand, headings, primary text on white' },
  { name: 'burgundy-dark', hex: '#45001f', bg: 'bg-burgundy-dark', note: 'Utility bar, footer, gradient start' },
  { name: 'orange', hex: '#FF4F17', bg: 'bg-orange', note: 'Accents, glow, bars, selected borders' },
  { name: 'orange-dark', hex: '#d93d0a', bg: 'bg-orange-dark', note: 'Orange buttons, small orange text' },
  { name: 'ink', hex: '#1c1c1e', bg: 'bg-ink', note: 'Body text' },
  { name: 'muted', hex: '#5f6368', bg: 'bg-muted-ink', note: 'Secondary text (text-muted-foreground)' },
  { name: 'line', hex: '#e6e1e3', bg: 'bg-line', note: 'Borders and dividers' },
  { name: 'soft', hex: '#faf6f7', bg: 'bg-soft', note: 'Alternate section background' },
  { name: 'ok', hex: '#1a7f4b', bg: 'bg-ok', note: 'Success' },
  { name: 'warn', hex: '#b26a00', bg: 'bg-warn', note: 'Warning, pending' },
]

const receipt = [
  { label: 'Typical cost of a crown', amount: '$1,200.00' },
  { label: 'Plan pays 50% after your $50 deductible', amount: '-$575.00' },
  { label: 'Over your annual max ($400 left)', amount: '+$175.00' },
]

const coverage = [
  { label: 'Preventive', pct: 100 },
  { label: 'Basic', pct: 80 },
  { label: 'Major', pct: 50 },
]

export default function StyleGuide() {
  return (
    <div className="space-y-14 pb-16">
      <section className="hero-banner rounded-[var(--radius-card)] px-6 py-12 sm:px-10 sm:py-16">
        <p className="eyebrow">Style guide</p>
        <h1 className="mt-2 max-w-xl text-4xl font-bold leading-tight sm:text-5xl">
          Your dental benefits, in plain English.
        </h1>
        <p className="mt-4 max-w-xl text-lg opacity-95">
          Burgundy for trust, orange for the things to look at. This is the hero banner with the orange glow.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-orange">Plan my year</button>
          <button className="btn btn-ghost">See my benefits</button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-burgundy">Colors</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {swatches.map((s) => (
            <div key={s.name} className="space-y-2">
              <div className={`h-16 rounded-xl border border-line ${s.bg}`} />
              <p className="text-sm font-semibold">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.hex}</p>
              <p className="text-xs text-muted-foreground">{s.note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-burgundy">Type</h2>
        <h1 className="text-5xl font-bold">Heading 1, Source Sans 3</h1>
        <h2 className="text-3xl font-bold">Heading 2, Source Sans 3</h2>
        <h3 className="text-xl font-bold">Heading 3, Source Sans 3</h3>
        <p className="max-w-xl">
          Body text, 16px. Crowns count as major work, which your plan covers at 50% after the deductible.
        </p>
        <p className="text-sm text-muted-foreground">Secondary text for notes and explanations.</p>
        <p className="eyebrow">Eyebrow label</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-burgundy">Numbers</h2>
        <div className="flex flex-wrap items-end gap-12">
          <div className="space-y-2">
            <p className="eyebrow">You pay</p>
            <p className="money text-7xl text-burgundy">$800</p>
          </div>
          <div className="space-y-2">
            <p className="eyebrow">Plan pays</p>
            <p className="money text-4xl">$400</p>
          </div>
          <div className="space-y-2">
            <p className="eyebrow">You save</p>
            <p className="money text-5xl text-orange-dark">$895</p>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-burgundy">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-orange">Orange</button>
          <button className="btn btn-outline">Outline</button>
          <button className="btn btn-orange" disabled>
            Disabled
          </button>
        </div>
        <div className="hero-banner flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] p-5">
          <button className="btn btn-orange">Orange on burgundy</button>
          <button className="btn btn-ghost">Ghost (use on burgundy)</button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-burgundy">Cards</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <div className="portal-card">
            <h4 className="portal-card-title">Plain card</h4>
            <p className="text-[0.9375rem] text-muted-foreground">Soft border, 18px corners, white background.</p>
          </div>
          <button className="portal-card portal-card-select text-left" aria-pressed="false">
            <h4 className="portal-card-title">Choosable card</h4>
            <p className="text-[0.9375rem] text-muted-foreground">Hover lifts it. Not selected.</p>
          </button>
          <button className="portal-card portal-card-select text-left" aria-pressed="true">
            <h4 className="portal-card-title">Selected card</h4>
            <p className="text-[0.9375rem] text-muted-foreground">Orange border and soft shadow.</p>
          </button>
        </div>

        <div className="portal-card max-w-md">
          <p className="eyebrow">Estimate · Crown (D2740)</p>
          <dl className="mt-4 divide-y divide-dashed divide-line">
            {receipt.map((r) => (
              <div key={r.label} className="flex justify-between gap-4 py-2 text-sm">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="money">{r.amount}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 flex items-end justify-between border-t-2 border-ink pt-4">
            <span className="font-semibold">You pay</span>
            <span className="money text-4xl text-burgundy">$800.00</span>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            This is an estimate. Your actual cost depends on your dentist's charges and claim review.
          </p>
        </div>

        <div className="result-panel max-w-md">
          <p className="text-sm opacity-90">Optimized total</p>
          <p className="money mt-1 text-5xl">$1,405</p>
          <p className="mt-1 text-sm opacity-90">You save $895 by spreading care across two plan years.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-burgundy">Coverage bars</h2>
        <div className="portal-card grid max-w-xl gap-4">
          {coverage.map((c) => (
            <div key={c.label}>
              <div className="mb-1.5 flex justify-between text-[0.9375rem] font-semibold">
                <span>{c.label}</span>
                <span>Plan pays {c.pct}%</span>
              </div>
              <div
                className="coverage"
                role="progressbar"
                aria-valuenow={c.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${c.label} coverage`}
              >
                <i style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="hero-banner max-w-xl rounded-[var(--radius-card)] p-5">
          <p className="text-sm opacity-90">Annual maximum left</p>
          <p className="money text-4xl">$400</p>
          <div className="coverage coverage-on-dark my-2">
            <i style={{ width: '73%' }} />
          </div>
          <div className="flex justify-between text-sm opacity-90">
            <span>$1,100 used</span>
            <span>$1,500 max</span>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-burgundy">Status chips</h2>
        <div className="flex flex-wrap gap-2">
          <span className="chip chip-ok">Covered</span>
          <span className="chip chip-warn">Limit reached</span>
          <span className="chip chip-pending">Pending verification</span>
          <span className="chip chip-off">Not eligible</span>
        </div>
        <p className="note max-w-xl">
          Notes use an orange left border on a light orange tint. Every status has a word, never color alone.
        </p>
      </section>
    </div>
  )
}
