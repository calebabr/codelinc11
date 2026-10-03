import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { useUser } from "@/state/UserContext"
import { getPlan } from "@/lib/mockApi"
import { money } from "@/lib/format"
import type { Category, Profile } from "@/lib/types"
import {
  CalendarRange,
  GraduationCap,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
} from "lucide-react"

const CATEGORY_COLOR: Record<Category, string> = {
  preventive: "bg-emerald-100 text-emerald-800",
  basic: "bg-blue-100 text-blue-800",
  major: "bg-amber-100 text-amber-800",
  ortho: "bg-violet-100 text-violet-800",
}

export function Profiles() {
  const { profiles, activeProfile, setActiveId, addProfile } = useUser()
  const plan = getPlan(activeProfile.planId)

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <h1 className="text-2xl font-semibold">Profiles</h1>
      </div>

      {/* Family members */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            active={p.id === activeProfile.id}
            dependentAgeLimit={getPlan(p.planId).dependentAgeLimit}
            studentAgeLimit={getPlan(p.planId).fullTimeStudentAgeLimit}
            onSelect={() => setActiveId(p.id)}
          />
        ))}
        <AddProfileCard onAdd={addProfile} defaultPlanId={plan.id} />
      </div>

      {/* Active profile: plan details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            {activeProfile.name}'s plan — {plan.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact
              icon={<CalendarRange className="size-4" />}
              label="Benefit period"
              value={plan.benefitPeriod}
            />
            <Fact
              icon={<Users className="size-4" />}
              label="Dependent age limit"
              value={`Up to ${plan.dependentAgeLimit}`}
            />
            <Fact
              icon={<GraduationCap className="size-4" />}
              label="Full-time student limit"
              value={`Up to ${plan.fullTimeStudentAgeLimit}`}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Fact label="Annual maximum" value={money(plan.annualMax)} />
            <Fact label="Deductible" value={`${money(plan.deductible)} (waived preventive)`} />
            <Fact label="Monthly premium" value={money(plan.monthlyPremium)} />
          </div>

          {/* Must-haves */}
          <div>
            <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
              <Star className="size-4 text-accent" />
              Must-have coverage
            </p>
            {activeProfile.mustHaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">None set.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {activeProfile.mustHaves.map((m) => (
                  <Badge key={m} variant="secondary">
                    {m}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Per-service breakdown */}
          <div>
            <p className="mb-2 text-sm font-medium">Covered services</p>
            <Accordion type="single" collapsible className="rounded-lg border">
              {plan.services.map((s) => (
                <AccordionItem key={s.code} value={s.code} className="px-3">
                  <AccordionTrigger className="hover:no-underline">
                    <span className="flex items-center gap-2 text-left">
                      <Badge className={`${CATEGORY_COLOR[s.category]} border-transparent`}>
                        {s.category}
                      </Badge>
                      <span className="text-sm font-medium">{s.name}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <dl className="grid gap-1 text-sm text-muted-foreground">
                      <Row label="Plan pays">
                        {Math.round(plan.coinsurance[s.category] * 100)}%
                      </Row>
                      <Row label="Frequency">{s.frequency}</Row>
                      {s.ageLimit && <Row label="Age limit">{s.ageLimit}</Row>}
                      {s.notes && <Row label="Details">{s.notes}</Row>}
                      <Row label="Code">{s.code}</Row>
                    </dl>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function ProfileCard({
  profile,
  active,
  dependentAgeLimit,
  studentAgeLimit,
  onSelect,
}: {
  profile: Profile
  active: boolean
  dependentAgeLimit: number
  studentAgeLimit: number
  onSelect: () => void
}) {
  const limit = profile.isFullTimeStudent ? studentAgeLimit : dependentAgeLimit
  const nearLimit = profile.relationship === "child" && profile.age >= limit - 3
  return (
    <button
      onClick={onSelect}
      className={`rounded-xl bg-card p-4 text-left ring-1 transition-colors ${
        active ? "ring-2 ring-primary" : "ring-foreground/10 hover:ring-foreground/20"
      }`}
    >
      <div className="flex items-center justify-between">
        <p className="font-medium">{profile.name}</p>
        {active && <Badge>Active</Badge>}
      </div>
      <p className="text-sm capitalize text-muted-foreground">
        {profile.relationship} · age {profile.age}
        {profile.isFullTimeStudent ? " · student" : ""}
      </p>
      {profile.relationship === "child" && (
        <p className={`mt-2 text-xs ${nearLimit ? "text-amber-700" : "text-muted-foreground"}`}>
          Covered as dependent up to age {limit}
          {nearLimit ? " — approaching limit" : ""}
        </p>
      )}
    </button>
  )
}

function AddProfileCard({
  onAdd,
  defaultPlanId,
}: {
  onAdd: ReturnType<typeof useUser>["addProfile"]
  defaultPlanId: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [relationship, setRelationship] = useState<Profile["relationship"]>("child")

  function submit() {
    if (!name.trim()) return
    onAdd({
      name: name.trim(),
      relationship,
      age: Number(age) || 0,
      isFullTimeStudent: false,
      planId: defaultPlanId,
      usage: { maxUsed: 0, deductibleMet: 0, cleaningsUsed: 0, cleaningsLimit: 2 },
      mustHaves: [],
    })
    setName("")
    setAge("")
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex min-h-[6.5rem] items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <UserPlus className="size-4" />
        Add a profile
      </button>
    )
  }

  return (
    <div className="space-y-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10">
      <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="flex gap-2">
        <Input
          placeholder="Age"
          inputMode="numeric"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="w-20"
        />
        <Select value={relationship} onValueChange={(v) => setRelationship(v as Profile["relationship"])}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="self">Self</SelectItem>
            <SelectItem value="spouse">Spouse</SelectItem>
            <SelectItem value="child">Child</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={submit}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function Fact({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-muted/50 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd className="text-right font-medium text-foreground">{children}</dd>
    </div>
  )
}
