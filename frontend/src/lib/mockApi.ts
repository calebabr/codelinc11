// Mock "backend" for the prototype.
//
// In the real app all dollar math lives in backend/app/engine/ and the UI only
// displays the numbers it gets back (docs/CONVENTIONS.md hard rule #1). There is
// no running backend yet, so this file plays the role of that engine: it is the
// ONE place money is computed. Pages and the chatbot call these functions and
// render the result — they never do arithmetic on dollars themselves.
//
// The logic reproduces the golden scenarios G1–G6 from docs/FEATURES.md §2.

import type { EstimateResult, Plan, Procedure, BenefitUsage } from "./types"
import { PLANS, PROCEDURES } from "./seed"

const round = (n: number) => Math.round(n * 100) / 100

export function getPlan(planId: string): Plan {
  return PLANS.find((p) => p.id === planId) ?? PLANS[0]
}

/** Hybrid-ish lookup: match a plain-English phrase to a procedure. */
export function findProcedure(query: string): Procedure | undefined {
  const q = query.toLowerCase().trim()
  if (!q) return undefined
  // exact code
  const byCode = PROCEDURES.find((p) => p.code.toLowerCase() === q)
  if (byCode) return byCode
  // synonym / name contains
  let best: { proc: Procedure; score: number } | undefined
  for (const proc of PROCEDURES) {
    const haystacks = [proc.name.toLowerCase(), ...proc.synonyms.map((s) => s.toLowerCase())]
    for (const h of haystacks) {
      let score = 0
      if (h === q) score = 100
      else if (q.includes(h) || h.includes(q)) score = 60 + Math.min(h.length, q.length)
      else {
        const words = q.split(/\s+/)
        const overlap = words.filter((w) => w.length > 2 && h.includes(w)).length
        score = overlap * 20
      }
      if (score > 0 && (!best || score > best.score)) best = { proc, score }
    }
  }
  return best && best.score > 0 ? best.proc : undefined
}

/**
 * Estimate out-of-pocket for a single procedure given a plan and current usage.
 * Reproduces golden scenarios G1–G6.
 */
export function estimate(
  proc: Procedure,
  plan: Plan,
  usage: BenefitUsage,
  inNetwork = true,
): EstimateResult {
  const trace: EstimateResult["trace"] = []
  const category = proc.category
  const billed = inNetwork ? proc.typicalFee : proc.outOfNetworkBilled
  const allowed = proc.typicalFee // plan pays on the in-network allowed amount
  const coinsurance = plan.coinsurance[category] // fraction plan pays

  // Frequency limit: cleanings capped per plan year (G6).
  if (proc.code === "D1110" && usage.cleaningsUsed >= usage.cleaningsLimit) {
    trace.push({
      label: `Cleaning limit reached (${usage.cleaningsUsed} of ${usage.cleaningsLimit} used)`,
      detail: "This plan covers 2 cleanings per plan year.",
    })
    return {
      procedureName: proc.name,
      code: proc.code,
      billed,
      planPays: 0,
      youPay: round(billed),
      inNetwork,
      covered: false,
      reason: "Frequency limit reached — not covered this plan year.",
      trace,
    }
  }

  // Deductible (waived for some categories).
  const deductibleApplies = !plan.deductibleWaivedFor.includes(category)
  let deductibleCharged = 0
  if (deductibleApplies) {
    deductibleCharged = Math.max(0, Math.min(plan.deductible - usage.deductibleMet, allowed))
    if (deductibleCharged > 0) {
      trace.push({
        label: "Deductible applied",
        amount: deductibleCharged,
        detail: `Deductible is $${plan.deductible}; $${usage.deductibleMet} already met.`,
      })
    }
  } else {
    trace.push({
      label: "Deductible waived",
      detail: `Waived for ${category} services.`,
    })
  }

  // Plan pays coinsurance on the allowed amount after the deductible.
  const afterDeductible = Math.max(0, allowed - deductibleCharged)
  let planPays = round(coinsurance * afterDeductible)
  trace.push({
    label: `Plan pays ${Math.round(coinsurance * 100)}% of $${round(afterDeductible)}`,
    amount: planPays,
    detail: `${category} coinsurance.`,
  })

  // Cap at remaining annual max (G3).
  const remainingMax = Math.max(0, plan.annualMax - usage.maxUsed)
  let capped = false
  if (planPays > remainingMax) {
    planPays = round(remainingMax)
    capped = true
    trace.push({
      label: "Capped at annual max left",
      amount: remainingMax,
      detail: `$${usage.maxUsed} of $${plan.annualMax} already used this year.`,
    })
  }

  // You pay = billed minus what the plan pays.
  let youPay = round(billed - planPays)
  let balanceBilling: number | undefined
  if (!inNetwork) {
    // The dentist can bill the difference above the allowed amount.
    balanceBilling = round(billed - allowed)
  }

  trace.push({
    label: "You pay",
    amount: youPay,
    detail: capped
      ? "Includes the part over your annual max."
      : "Billed amount minus what the plan pays.",
  })

  return {
    procedureName: proc.name,
    code: proc.code,
    billed: round(billed),
    planPays: round(planPays),
    youPay,
    inNetwork,
    balanceBilling,
    covered: true,
    trace,
  }
}

export interface BenefitsStatus {
  annualMax: number
  maxUsed: number
  maxLeft: number
  deductible: number
  deductibleMet: number
  cleaningsUsed: number
  cleaningsLimit: number
  unusedPreventiveValue: number
}

export function benefitsStatus(plan: Plan, usage: BenefitUsage): BenefitsStatus {
  const maxLeft = round(plan.annualMax - usage.maxUsed)
  const cleaningFee = PROCEDURES.find((p) => p.code === "D1110")?.typicalFee ?? 120
  const unusedPreventiveValue = round(
    Math.max(0, usage.cleaningsLimit - usage.cleaningsUsed) * cleaningFee,
  )
  return {
    annualMax: plan.annualMax,
    maxUsed: usage.maxUsed,
    maxLeft,
    deductible: plan.deductible,
    deductibleMet: usage.deductibleMet,
    cleaningsUsed: usage.cleaningsUsed,
    cleaningsLimit: usage.cleaningsLimit,
    unusedPreventiveValue,
  }
}

/** Plan My Year headline numbers (golden scenario S2). */
export interface YearPlan {
  everythingNowYouPay: number
  optimizedYouPay: number
  savings: number
  summary: string
}

export function yearPlanS2(): YearPlan {
  return {
    everythingNowYouPay: 2300,
    optimizedYouPay: 1405,
    savings: 895,
    summary:
      "Do the urgent root canal now; wait until January for the crown and fillings when your annual max resets.",
  }
}
