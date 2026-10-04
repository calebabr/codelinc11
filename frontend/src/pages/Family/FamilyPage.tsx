import { useEffect, useState } from "react"
import { FamilyTree } from "@/features/family/FamilyTree"
import { MemberDetail } from "@/features/family/MemberDetail"
import { useOverview } from "@/features/family/useFamily"
import { AddMemberCard } from "@/features/family/AddMemberForm"
import { NameFamilyForm } from "@/features/family/NameFamilyForm"
import { useSession } from "@/state/SessionContext"

export default function FamilyPage() {
  const session = useSession()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [renaming, setRenaming] = useState(false)
  const [removed, setRemoved] = useState<string | null>(null)

  const { household, user: viewer, token, accounts } = session
  const members = household.members

  useEffect(() => {
    setSelectedId((cur) => (cur && household.members.some((m) => m.id === cur) ? cur : viewer.id))
  }, [household, viewer])

  const selected = members.find((m) => m.id === selectedId) ?? null
  const overview = useOverview(selected?.id ?? null, token, reload)
  const viewerIsPrimary = viewer.role === "primary"
  // Only demo families can be edited. A non-primary adult may edit only themself.
  const editable = !!session.sandbox
  const canEditSelected =
    editable && !!selected && (viewerIsPrimary || (viewer.role === "adult" && selected.id === viewer.id))

  return (
    <div className="space-y-8 pb-12">
      <header className="hero-banner rounded-[24px] p-6 sm:p-10">
        <p className="eyebrow">{household.name}</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-5xl">Family</h1>
        <p className="mt-2 max-w-xl text-white/90">
          Tap a person to see what they can use and how much of their own yearly maximum is left.
          {` Plan: ${household.plan_tier.name}.`}
        </p>
      </header>

      <p className="text-sm text-muted-foreground">
        This is an estimate. Your actual cost depends on your dentist's charges and claim review.
      </p>

      {viewerIsPrimary && session.sandbox && (
        <div>
          {renaming ? (
            <NameFamilyForm title="Rename family" cancelLabel="Cancel" onDone={() => setRenaming(false)} />
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => setRenaming(true)}>
              Rename family
            </button>
          )}
        </div>
      )}

      {viewerIsPrimary && editable && (
        <AddMemberCard
          onAdded={(m) => {
            setRemoved(null)
            setSelectedId(m.id)
          }}
        />
      )}
      {removed && (
        <p className="note" role="status">
          {removed} was removed from your family.
        </p>
      )}

      <>
          {members.length === 0 ? (
            <p className="note">No family members to show yet.</p>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <div className="portal-card">
                <h2 className="portal-card-title">{viewerIsPrimary ? "Your household" : "Your profile"}</h2>
                <div className="mt-4">
                  <FamilyTree members={members} selectedId={selectedId} onSelect={setSelectedId} />
                </div>
                {!viewerIsPrimary && (
                  <p className="mt-4 text-sm text-muted-foreground">
                    You can see your own benefits. The account holder can see the whole family.
                  </p>
                )}
              </div>
              {selected && (
                <MemberDetail
                  key={selected.id}
                  canEdit={canEditSelected}
                  onChanged={() => setReload((n) => n + 1)}
                  onRemoved={(name) => {
                    setRemoved(name)
                    setSelectedId(viewer.id)
                  }}
                  member={selected}
                  overview={overview}
                  viewerIsPrimary={viewerIsPrimary}
                  householdId={household.id}
                  token={token}
                  canViewAs={viewerIsPrimary || selected.id === viewer.id}
                  isActive={session.activeMember.id === selected.id}
                  onViewAs={() => session.setActiveMemberId(selected.id)}
                  onRetry={() => setReload((n) => n + 1)}
                />
              )}
            </div>
          )}

          {accounts.length > 1 && (
            <section aria-label="Demo sign-in" className="portal-card">
              <h2 className="portal-card-title">Demo sign-in</h2>
              <p className="text-sm text-muted-foreground">
                Pick a demo account to see what each person is allowed to see. No password is needed.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {accounts
                  .filter((a) => a.household_id === household.id)
                  .map((a) => (
                    <button
                      key={a.account_id}
                      type="button"
                      className="chip portal-card-select min-h-11"
                      aria-pressed={a.member_id === viewer.id}
                      onClick={() => void session.signIn(a.member_id)}
                    >
                      {a.display_name} ({a.role})
                    </button>
                  ))}
              </div>
            </section>
          )}
      </>
    </div>
  )
}
