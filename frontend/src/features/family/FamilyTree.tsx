import type { FamilyMember } from "@/lib/types/family"

function Node({ m, selected, onSelect }: { m: FamilyMember; selected: boolean; onSelect: () => void }) {
  const pending = m.status === "pending"
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${m.name}, ${m.relationship}, age ${m.age}${pending ? ", pending verification" : ""}`}
      data-testid={`node-${m.id}`}
      className={`portal-card portal-card-select flex w-40 flex-col items-center gap-1 !p-4 text-center sm:w-48 ${
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
        {pending && <span className="chip chip-pending">Pending</span>}
        {m.has_login && <span className="chip chip-ok">Has login</span>}
        {!m.has_login && m.role === "managed" && <span className="chip chip-off">Managed profile</span>}
      </span>
    </button>
  )
}

export function FamilyTree({
  members,
  selectedId,
  onSelect,
}: {
  members: FamilyMember[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const parents = members.filter((m) => m.relationship === "self" || m.relationship === "spouse")
  const kids = members.filter((m) => m.relationship !== "self" && m.relationship !== "spouse")
  return (
    <div role="group" aria-label="Family tree" className="flex flex-col items-center">
      {parents.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-y-3">
          {parents.map((m, i) => (
            <div key={m.id} className="flex items-center">
              {i > 0 && <span aria-hidden="true" className="h-0.5 w-6 bg-[var(--line)]" />}
              <Node m={m} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
            </div>
          ))}
        </div>
      )}
      {kids.length > 0 && (
        <>
          {parents.length > 0 && <span aria-hidden="true" className="h-6 w-0.5 bg-[var(--line)]" />}
          <div className="flex flex-wrap justify-center gap-3">
            {kids.map((m) => (
              <Node key={m.id} m={m} selected={m.id === selectedId} onSelect={() => onSelect(m.id)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
