import { useUser } from "@/state/UserContext"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserRound } from "lucide-react"

export function ProfileSwitcher() {
  const { profiles, activeId, setActiveId } = useUser()
  return (
    <div className="flex items-center gap-2">
      <UserRound className="size-4 text-muted-foreground" />
      <Select value={activeId} onValueChange={setActiveId}>
        <SelectTrigger size="sm" className="min-w-[11rem]" aria-label="Active profile">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name} · {p.relationship}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
