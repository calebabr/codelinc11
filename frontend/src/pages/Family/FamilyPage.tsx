import { useEffect, useState } from "react"
import { FamilyTree } from "@/features/family/FamilyTree"
import { MemberDetail } from "@/features/family/MemberDetail"
import { useFamilySession, useOverview } from "@/features/family/useFamily"
import { useSession } from "@/state/SessionContext"

export default function FamilyPage() {
  const session = useSession()
  const fam = useFamilySession(session.activeMember.id)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  const login = fam.login
  const members = login?.household.members ?? []
  const viewer = login?.member ?? null

  useEffect(() => {
    if (!login) return
    setSelectedId((cur) => (cur && login.household.members.some((m) => m.id === cur) ? cur : login.member.id))
  }, [login])

  const selected = members.find((m) => m.id === selectedId) ?? null
  const overview = useOverview(selected?.id ?? null, login?.token ?? null, reload)
  const viewerIsPrimary = viewer?.role === "primary"

  return (
    <div className="space-y-8 pb-12">
      <header className="hero-banner rounded-[24px] p-6 sm:p-10">
        <p className="eyebrow">{login ? login.household.name : "Your household"}</p>
        <h1 className="mt-2 text-3xl font-bold text-white sm:text-5xl">Family</h1>
        <p className="mt-2 max-w-xl text-white/90">
          Tap a person to see what they can use and how much of their own yearly maximum is left.
          {login && ` Plan: ${login.household.plan_tier.name}.`}
        </p>
      </header>

      {fam.loading && <p role="status">Loading your family…</p>}
      {fam.error && (
        <div role="alert" className="note">
          <p>{fam.error}</p>
          <button type="button" className="btn btn-outline mt-2" onClick={fam.retry}>
            Try again
          </button>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        This is an estimate. Your actual cost depends on your dentist's charges and claim review.
      </p>

      {login && (
        <>
          {members.length === 0 ? (
            <p className="note">No family members to show yet.</p>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
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
                  member={selected}
                  overview={overview}
                  viewerIsPrimary={viewerIsPrimary}
                  householdId={login.household.id}
                  token={login.token}
                  canViewAs={viewerIsPrimary || selected.id === viewer?.id}
                  isActive={session.activeMember.id === selected.id}
                  onViewAs={() => session.setActiveMemberId(selected.id)}
                  onRetry={() => setReload((n) => n + 1)}
                />
              )}
            </div>
          )}

          {fam.accounts.length > 1 && (
            <section aria-label="Demo sign-in" className="portal-card">
              <h2 className="portal-card-title">Demo sign-in</h2>
              <p className="text-sm text-muted-foreground">
                Pick a demo account to see what each person is allowed to see. No password is needed.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fam.accounts
                  .filter((a) => a.household_id === login.household.id)
                  .map((a) => (
                    <button
                      key={a.account_id}
                      type="button"
                      className="chip portal-card-select"
                      aria-pressed={a.member_id === viewer?.id}
                      onClick={() => fam.signInAs(a.member_id)}
                    >
                      {a.display_name} ({a.role})
                    </button>
                  ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
