import type { FamilyMember } from "@/lib/types/family"

function Node({ m, selected, onSelect, primaryName }: { m: FamilyMember; selected: boolean; onSelect: () => void; primaryName: string }) {
  const pending = m.status === "pending"
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${m.name}, ${m.relationship}, age ${m.age}${pending ? ", pending verification" : ""}`}
      data-testid={`node-${m.id}`}
      className={`portal-card portal-card-select flex w-36 flex-col items-center gap-1 !p-4 text-center sm:w-48 ${
        pending ? "border-dashed" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-burgundy text-lg font-bold text-white"
      >
        {m.name.charAt(0)}
      </span>
      <span className="font-bold text-burgundy">{m.name}</span>
      <span className="text-sm capitalize text-muted-foreground">
        {m.relationship} · age {m.age}
      </span>
      <span className="flex flex-wrap justify-center gap-1">
        {pending && <span className="chip chip-pending">Waiting for approval</span>}
        {!pending && m.has_login && <span className="chip chip-ok">Has their own account</span>}
        {!pending && !m.has_login && m.role === "managed" && <span className="chip chip-off">Managed by {primaryName}</span>}
      </span>
    </button>
  )
}

const PARTNER = new Set(["self", "spouse", "partner", "domestic partner"])

/** Decorative connector line. Always hidden from assistive tech. */
function Line({ className, on, dashed }: { className: string; on?: boolean; dashed?: boolean }) {
  return (
    <span
      aria-hidden="true"
      data-testid="connector"
      data-active={on ? "true" : "false"}
      className={`absolute ${className} ${on ? "border-burgundy" : "border-[var(--line)]"} ${dashed ? "border-dashed" : ""}`}
    />
  )
}

/*
 * The backend has no parent or partner field, so the tree is inferred from the
 * relationship label: self + spouse/partner are the couple; everyone else hangs
 * from the couple (a child with their own login, such as Robert, hangs the same way).
 */
export function FamilyTree({
  members,
  selectedId,
  onSelect,
}: {
  members: FamilyMember[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const parents = members.filter((m) => PARTNER.has(m.relationship.toLowerCase()))
  const rest = members.filter((m) => !PARTNER.has(m.relationship.toLowerCase()))
  const extras = rest.filter((m) => m.relationship.toLowerCase() === "other")
  const kids = rest.filter((m) => m.relationship.toLowerCase() !== "other")
  const primaryName = (members.find((x) => x.role === "primary")?.name ?? "a parent").split(" ")[0]
  const parentActive = parents.some((m) => m.id === selectedId)
  const kidActive = rest.some((m) => m.id === selectedId)
  const stemOn = parentActive || kidActive
  return (
    <div role="group" aria-label="Family tree" className="flex flex-col items-center" data-testid="family-tree">
      {parents.length > 0 && (
        <div className="flex flex-col items-center sm:flex-row" data-testid="couple">
          {parents.map((m, i) => (
            <div key={m.id} className="flex flex-col items-center sm:flex-row">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  data-testid="partner-link"
                  className={`relative flex items-center justify-center text-xs ${
                    parentActive && (m.id === selectedId || parents[i - 1].id === selectedId) ? "text-burgundy" : "text-[var(--line)]"
                  } h-6 w-0 border-l-2 border-current sm:h-0 sm:w-8 sm:border-l-0 sm:border-t-2`}
                >
                  <span className="absolute rounded-full bg-white px-0.5 leading-none">&#9829;</span>
                </span>
              )}
              <Node primaryName={primaryName} m={m} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
            </div>
          ))}
        </div>
      )}
      {kids.length > 0 && (
        <>
          {parents.length > 0 && (
            <span
              aria-hidden="true"
              data-testid="connector"
              data-active={stemOn ? "true" : "false"}
              className={`h-6 w-0 border-l-2 ${stemOn ? "border-burgundy" : "border-[var(--line)]"}`}
            />
          )}
          <div className="flex justify-center" data-testid="children">
            {kids.map((m, i) => {
              const on = m.id === selectedId
              const dashed = m.status === "pending"
              const multi = kids.length > 1
              return (
                <div key={m.id} className="relative flex flex-col items-center px-1 pt-6 sm:px-2">
                  {parents.length > 0 && (
                    <>
                      <Line className="left-1/2 top-0 h-6 -translate-x-px border-l-2" on={on} dashed={dashed} />
                      {multi && i > 0 && <Line className="left-0 top-0 w-1/2 border-t-2" on={on} />}
                      {multi && i < kids.length - 1 && <Line className="right-0 top-0 w-1/2 border-t-2" on={kids[i + 1].id === selectedId || on} />}
                    </>
                  )}
                  <Node primaryName={primaryName} m={m} selected={on} onSelect={() => onSelect(m.id)} />
                </div>
              )
            })}
          </div>
        </>
      )}
      {extras.length > 0 && (
        <div className="flex flex-col items-center" data-testid="extras">
          <span
            aria-hidden="true"
            data-testid="connector"
            data-active={extras.some((m) => m.id === selectedId) ? "true" : "false"}
            className="h-6 w-0 border-l-2 border-dashed border-[var(--line)]"
          />
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Other family</p>
          <div className="flex flex-wrap justify-center gap-2">
            {extras.map((m) => (
              <Node key={m.id} primaryName={primaryName} m={m} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
            ))}
          </div>
        </div>
      )}
      <p className="mt-4 max-w-md text-center text-sm text-muted-foreground" data-testid="tree-legend">
        Adults 18 and over can have their own account. Children's profiles are managed by a parent.
      </p>
    </div>
  )
}
