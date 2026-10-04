import { useEffect, useMemo, useState } from "react"
import { useSession } from "@/state/SessionContext"
import { ErrorNote } from "@/components/ErrorNote"
import { ApiError, errorMessage, getProcedures } from "@/lib/api/planYear"
import type { Procedure } from "@/lib/types/planYear"
import type { NetworkFilter, ProviderQuery, Specialty } from "@/lib/types/providers"
import { useProviders } from "@/features/providers/useProviders"
import { ProviderCard } from "@/features/providers/ProviderCard"

/** The ZIPs the demo directory knows (the list in the server's unknown-ZIP message, backend routers/providers.py). */
const DEMO_ZIPS = ["36830", "30303", "19087", "46802", "27401"]
const RADII = [10, 25, 50]
const NETWORKS: { value: NetworkFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "In network" },
  { value: "out", label: "Out of network" },
]
const SPECIALTIES: { value: Specialty; label: string }[] = [
  { value: "general", label: "General" },
  { value: "pediatric", label: "Children's" },
  { value: "orthodontics", label: "Braces" },
  { value: "oral_surgery", label: "Surgery" },
  { value: "endodontics", label: "Root canals" },
  { value: "periodontics", label: "Gums" },
]

const zipKey = (householdId: string) => `dental.providersZip.v1.${householdId}`
function readZip(householdId: string): string | null {
  try {
    return localStorage.getItem(zipKey(householdId))
  } catch {
    return null
  }
}
function writeZip(householdId: string, zip: string) {
  try {
    localStorage.setItem(zipKey(householdId), zip)
  } catch {
    /* storage may be blocked; the search still works */
  }
}

const chip = (on: boolean) => `chip min-h-11 cursor-pointer border px-4 ${on ? "border-burgundy bg-burgundy text-white" : "border-line bg-white"}`

export default function ProvidersPage() {
  const { activeMember, household, token, updateMember } = useSession()
  const memberId = activeMember.id
  const profileZip = activeMember.zip ?? ""
  const startZip = readZip(household.id) ?? profileZip

  const [zip, setZip] = useState(startZip)
  const [appliedZip, setAppliedZip] = useState(startZip)
  const [zipError, setZipError] = useState<string | null>(null)
  const [radius, setRadius] = useState(25)
  const [network, setNetwork] = useState<NetworkFilter>("all")
  const [specialty, setSpecialty] = useState<Specialty | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState<string | null>(null)

  // Another person (or family) can mean another ZIP.
  useEffect(() => {
    const z = readZip(household.id) ?? profileZip
    setZip(z)
    setAppliedZip(z)
    setZipError(null)
  }, [memberId, household.id, profileZip])

  const [procs, setProcs] = useState<Procedure[]>([])
  const [procError, setProcError] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    getProcedures().then(
      (m) => {
        if (!cancelled) setProcs(m.map((x) => x.procedure))
      },
      (e) => {
        if (!cancelled) setProcError(errorMessage(e))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  const query = useMemo<ProviderQuery | null>(
    () =>
      appliedZip
        ? { zip: appliedZip, radius_mi: radius, network, specialty, accepting, q: name, code, member_id: memberId }
        : null,
    [appliedZip, radius, network, specialty, accepting, name, code, memberId],
  )
  const providers = useProviders(query, token)

  function submitZip(e?: React.FormEvent) {
    e?.preventDefault()
    const z = zip.trim()
    if (!/^\d{5}$/.test(z)) {
      setZipError("Enter a 5-digit ZIP code, for example 36830.")
      return
    }
    setZipError(null)
    writeZip(household.id, z)
    setAppliedZip(z)
  }

  const myDentist = activeMember.primary_dentist_id ?? null
  const [busyId, setBusyId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  async function setDentist(id: string | null, providerId: string) {
    setBusyId(providerId)
    setSaveError(null)
    try {
      await updateMember(memberId, { primary_dentist_id: id })
    } catch (e) {
      setSaveError(
        e instanceof ApiError && e.status === 403
          ? "The shared demo family can't be edited. Start your own demo family."
          : errorMessage(e),
      )
    } finally {
      setBusyId(null)
    }
  }

  const first = activeMember.name.split(" ")[0]
  const n = providers.list.length
  // The server's message for a ZIP it does not know lists the ZIPs it does (backend routers/providers.py).
  const unknownZip = /do not have that ZIP/i.test(providers.error ?? "")
  const listed = unknownZip ? Array.from(new Set((providers.error ?? "").match(/\b\d{5}\b/g) ?? [])) : []
  const tryZips = listed.length > 0 ? listed : DEMO_ZIPS
  function pickZip(z: string) {
    setZip(z)
    setZipError(null)
    writeZip(household.id, z)
    setAppliedZip(z)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-4xl font-bold text-burgundy sm:text-5xl">Find a dentist near you</h1>
        <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
          Search by ZIP code for {first}. See who is in your plan's network and what a visit may cost.
        </p>
      </header>

      <section className="portal-card space-y-4" aria-label="Search filters">
        <form onSubmit={submitZip} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 basis-40">
            <label htmlFor="prov-zip" className="block text-sm font-semibold">ZIP code</label>
            <input
              id="prov-zip"
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
              value={zip}
              onChange={(e) => setZip(e.target.value.replace(/\D/g, ""))}
              aria-invalid={zipError ? true : undefined}
              aria-describedby={zipError ? "prov-zip-err" : undefined}
              className="mt-1 min-h-11 w-full rounded-full border border-line bg-white px-4 text-base"
            />
          </div>
          <button type="submit" className="btn btn-orange">Search</button>
        </form>
        {zipError && <p id="prov-zip-err" role="alert" className="note">{zipError}</p>}

        <div>
          <label htmlFor="prov-name" className="block text-sm font-semibold">Practice or dentist name (optional)</label>
          <input
            id="prov-name"
            type="search"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 min-h-11 w-full rounded-full border border-line bg-white px-4 text-base"
          />
        </div>

        <div role="group" aria-label="How far to look" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Distance</span>
          {RADII.map((r) => (
            <button key={r} type="button" aria-pressed={radius === r} className={chip(radius === r)} onClick={() => setRadius(r)}>
              {r} miles
            </button>
          ))}
        </div>

        <div>
          <div role="group" aria-label="Network" className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">Network</span>
            {NETWORKS.map((o) => (
              <button key={o.value} type="button" aria-pressed={network === o.value} className={chip(network === o.value)} onClick={() => setNetwork(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            In network means a lower price. Out of network can cost more because the dentist can bill you the difference.
          </p>
        </div>

        <div role="group" aria-label="Type of care" className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Type of care</span>
          <button type="button" aria-pressed={specialty === null} className={chip(specialty === null)} onClick={() => setSpecialty(null)}>Any</button>
          {SPECIALTIES.map((s) => (
            <button
              key={s.value}
              type="button"
              aria-pressed={specialty === s.value}
              className={chip(specialty === s.value)}
              onClick={() => setSpecialty(specialty === s.value ? null : s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={accepting}
          onClick={() => setAccepting((v) => !v)}
          className="flex min-h-11 items-center gap-3 text-left"
        >
          <span
            aria-hidden="true"
            className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line px-0.5 ${accepting ? "justify-end bg-burgundy" : "justify-start bg-muted"}`}
          >
            <span className="size-5 rounded-full bg-white shadow" />
          </span>
          <span className="text-sm font-semibold">Accepting new patients</span>
        </button>

        <div>
          <p className="text-sm font-semibold">Price a procedure (optional)</p>
          <p className="text-sm text-muted-foreground">Tap one to see what you would pay at each dentist. Tap it again to clear.</p>
          {procError && <p className="mt-2 text-sm text-muted-foreground">Prices are not available right now.</p>}
          <ul className="mt-2 grid max-h-56 gap-2 overflow-y-auto sm:grid-cols-2" aria-label="Procedures to price">
            {procs.map((p) => (
              <li key={p.code}>
                <button
                  type="button"
                  aria-pressed={code === p.code}
                  data-selected={code === p.code ? "true" : undefined}
                  onClick={() => setCode(code === p.code ? null : p.code)}
                  className="portal-card-select min-h-11 w-full rounded-2xl border border-line bg-white p-3 text-left"
                  aria-label={`Price ${p.name}`}
                >
                  <span className="block font-semibold text-burgundy">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.code}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-label="Results" aria-live="polite" className="space-y-3">
        {saveError && <p role="alert" className="note">{saveError}</p>}
        {!query && !providers.error && (
          <p className="portal-card text-sm text-muted-foreground">Enter your ZIP code and tap Search to see dentists near you.</p>
        )}
        {providers.loading && <p role="status" className="portal-card text-sm">Finding dentists...</p>}
        {providers.error && unknownZip && (
          <div role="alert" className="note" data-testid="zip-help">
            <p>{providers.error}</p>
            <div role="group" aria-label="ZIP codes to try" className="mt-2 flex flex-wrap gap-2">
              {tryZips.map((z) => (
                <button key={z} type="button" className={chip(appliedZip === z)} onClick={() => pickZip(z)}>
                  {z}
                </button>
              ))}
            </div>
          </div>
        )}
        {providers.error && !unknownZip && <ErrorNote message={providers.error} onRetry={providers.retry} />}
        {query && !providers.loading && !providers.error && n === 0 && (
          <p className="portal-card text-sm">No dentists within {radius} miles. Try a wider radius.</p>
        )}
        {!providers.loading && !providers.error && n > 0 && (
          <p className="text-sm text-muted-foreground" data-testid="provider-count">
            {n} {n === 1 ? "dentist" : "dentists"} found, nearest first
          </p>
        )}
        {!providers.error && (
          <ul className="space-y-3" aria-label="Dentists">
            {providers.list.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                isMine={myDentist === p.id}
                busy={busyId === p.id}
                onSet={() => setDentist(p.id, p.id)}
                onRemove={() => setDentist(null, p.id)}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">Demo directory: the practices are fictional.</p>
      <p className="text-xs text-muted-foreground">
        This is an estimate. Your actual cost depends on your dentist's charges and claim review.
      </p>
    </div>
  )
}
