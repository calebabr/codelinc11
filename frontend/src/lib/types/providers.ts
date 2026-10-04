// Shapes for the Find Providers page. They mirror GET /providers (backend B3).

export type Specialty = "general" | "pediatric" | "orthodontics" | "oral_surgery" | "endodontics" | "periodontics"
export type NetworkFilter = "all" | "in" | "out"

export interface ProviderEstimate {
  you_pay: number
  plan_pays: number
  in_network: boolean
  /** What the dentist can bill beyond the plan allowance (out of network). */
  balance_bill: number
  note?: string | null
}

export interface Provider {
  id: string
  practice_name: string
  dentist_name: string
  specialty: Specialty
  address: string
  city: string
  state: string
  zip: string
  phone: string
  accepting_new: boolean
  languages: string[]
  /** Miles from the searched ZIP, computed by the server. */
  distance_mi: number
  /** For the household's current plan. */
  in_network: boolean
  estimate?: ProviderEstimate | null
}

export interface ProviderQuery {
  zip?: string
  radius_mi: number
  network: NetworkFilter
  specialty?: Specialty | null
  accepting?: boolean
  q?: string
  code?: string | null
  member_id?: string
}
