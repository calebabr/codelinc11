// Shape of GET /plans (backend/app/models.py, class Plan). Values are shown, never calculated.
export type PlanCategory = "preventive" | "basic" | "major"

export interface PlanTier {
  id: string
  name: string
  description: string
  monthly_premium: number
  deductible: number
  deductible_waived_for: PlanCategory[]
  annual_max: number
  coinsurance: Partial<Record<PlanCategory, number>>
  frequency: Record<string, number>
  plan_year_start_month: number
  orthodontia_child: number
  alternate_benefit: boolean
}
