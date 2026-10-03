// Prototype chatbot "agent".
//
// This stands in for backend/app/agent/ (the LLM tool-calling loop) from
// docs/FEATURES.md F5. The important product idea it demonstrates:
//
//   PERSONALIZED AI CONTEXT — the assistant retrieves the ACTIVE profile's
//   plan, dental history, benefit usage and preferences before answering, so
//   two profiles asking the same question get different, personal answers. It
//   also "learns": every exchange appends to that profile's aiContext.
//
// All dollar amounts in answers come from the mock engine (mockApi.ts), never
// from string math here — the same rule the real LLM follows via the number
// guard.

import type { AiContext, Profile, ToolCall } from "./types"
import { benefitsStatus, estimate, findProcedure, getPlan, yearPlanS2 } from "./mockApi"
import { money } from "./format"

export interface ChatTurnResult {
  text: string
  tools: ToolCall[]
  // Updates to fold back into the profile's AI context ("learning").
  learned: Partial<AiContext>
}

interface Intent {
  kind: "estimate" | "wait" | "benefits" | "year" | "plan" | "history" | "mustHave" | "greeting" | "unknown"
  inNetwork: boolean
}

function classify(message: string): Intent {
  const m = message.toLowerCase()
  const inNetwork = !/(out[- ]?of[- ]?network|different dentist|not in network)/.test(m)
  if (/(hi|hello|hey|what can you|help)\b/.test(m) && m.length < 40)
    return { kind: "greeting", inNetwork }
  if (/(wait|january|next year|next plan year|hold off|later)/.test(m) && /(crown|cap|procedure|it)/.test(m))
    return { kind: "wait", inNetwork }
  if (/(left|remaining|how much.*(max|benefit)|benefits|used|deductible|expire)/.test(m))
    return { kind: "benefits", inNetwork }
  if (/(plan my year|sequence|order|schedule|save|optimi[sz]e|cheapest.*order)/.test(m))
    return { kind: "year", inNetwork }
  if (/(my plan|current plan|plan details|coverage|what does my plan cover|deductible|annual max)/.test(m))
    return { kind: "plan", inNetwork }
  if (/(history|past|previous procedure|what have i had|did i get)/.test(m))
    return { kind: "history", inNetwork }
  if (/(must[- ]?have|need covered|braces|orthodont)/.test(m))
    return { kind: "mustHave", inNetwork }
  if (/(cost|how much|price|pay|owe|crown|cap|filling|cleaning|root canal|estimate)/.test(m))
    return { kind: "estimate", inNetwork }
  return { kind: "unknown", inNetwork }
}

/**
 * Produce a personalized answer for the active profile. Returns the full text,
 * the sequence of tool calls (for the "Calculating…" chips), and what to learn.
 */
export function answer(message: string, profile: Profile): ChatTurnResult {
  const plan = getPlan(profile.planId)
  const intent = classify(message)
  const tools: ToolCall[] = []
  const learned: Partial<AiContext> = {
    previousQuestions: [...profile.aiContext.previousQuestions, message].slice(-8),
  }

  const firstName = profile.name.split(" ")[0]

  switch (intent.kind) {
    case "greeting":
      return {
        text:
          `Hi ${firstName}! I'm your plan assistant and I already know your coverage. ` +
          `You're on the ${plan.name} with ${money(plan.annualMax - profile.usage.maxUsed)} left of your annual max this year. ` +
          `Ask me things like "what will a crown cost?", "what if I wait until January?", or "what do I have left?"`,
        tools,
        learned,
      }

    case "plan": {
      tools.push({ name: "get_plan_details", status: "done" })
      const text =
        `Here's your ${plan.name} in plain English, ${firstName}:\n\n` +
        `• **Annual maximum:** ${money(plan.annualMax)} — the plan pays up to this each year.\n` +
        `• **Deductible:** ${money(plan.deductible)} (waived for cleanings and exams).\n` +
        `• **Cleanings & checkups:** covered 100%, 2 per year.\n` +
        `• **Basic work (fillings, root canals):** plan pays ${Math.round(plan.coinsurance.basic * 100)}%.\n` +
        `• **Major work (crowns):** plan pays ${Math.round(plan.coinsurance.major * 100)}%.\n` +
        `• **Benefit period:** ${plan.benefitPeriod}. Dependents covered to age ${plan.dependentAgeLimit}.`
      return { text, tools, learned: appendHighlight(learned, profile, "Reviewed full plan details.") }
    }

    case "estimate": {
      tools.push({ name: "find_procedure", status: "done" })
      const proc = findProcedure(message) ?? findProcedure("crown")!
      tools.push({ name: "estimate_cost", status: "done" })
      const result = estimate(proc, plan, profile.usage, intent.inNetwork)
      let text: string
      if (!result.covered) {
        text =
          `For a **${proc.name.toLowerCase()}**: ${result.reason} ` +
          `You'd pay the full ${money(result.youPay)}. ` +
          `Want me to tell you when it resets?`
      } else {
        text =
          `For a **${proc.name.toLowerCase()}**${intent.inNetwork ? "" : " (out of network)"}, here's your estimate, ${firstName}:\n\n` +
          `• Billed: ${money(result.billed)}\n` +
          `• Your plan pays: ${money(result.planPays)}\n` +
          `• **You pay: ${money(result.youPay)}**` +
          (result.balanceBilling ? `\n• Of that, ${money(result.balanceBilling)} is balance billing (the amount above the in-network allowed charge).` : "") +
          `\n\nThis uses your real usage: ${money(plan.annualMax - profile.usage.maxUsed)} of your annual max is left.`
      }
      return {
        text: withDisclaimer(text),
        tools,
        learned: appendProcedure(learned, profile, `Asked about ${proc.name}`),
      }
    }

    case "wait": {
      // G3 (now) vs G4 (fresh year) — the signature "wait until January" answer.
      tools.push({ name: "find_procedure", status: "done" })
      const crown = findProcedure("crown")!
      tools.push({ name: "estimate_cost", status: "done" })
      const now = estimate(crown, plan, profile.usage, intent.inNetwork)
      const fresh = estimate(crown, plan, { ...profile.usage, maxUsed: 0, deductibleMet: 0 }, intent.inNetwork)
      const diff = now.youPay - fresh.youPay
      const text =
        `Good question, ${firstName}. For your **crown**:\n\n` +
        `• **Now:** you pay ${money(now.youPay)} (you've used most of this year's max).\n` +
        `• **In January (new plan year):** you pay ${money(fresh.youPay)}.\n\n` +
        (diff > 0
          ? `Waiting until January saves you **${money(diff)}**. If it's not urgent, that's the cheaper path.`
          : `There's no savings from waiting in your case.`) +
        `\n\n(If a dentist says it's urgent, don't wait — get care first.)`
      return {
        text: withDisclaimer(text),
        tools,
        learned: appendPreference(learned, profile, "Compared cost of waiting until the new plan year."),
      }
    }

    case "benefits": {
      tools.push({ name: "get_benefits_status", status: "done" })
      const s = benefitsStatus(plan, profile.usage)
      const text =
        `Here's where you stand this year, ${firstName}:\n\n` +
        `• **Annual max:** ${money(s.maxLeft)} left of ${money(s.annualMax)}.\n` +
        `• **Deductible:** ${money(s.deductibleMet)} of ${money(s.deductible)} met.\n` +
        `• **Cleanings:** ${s.cleaningsUsed} of ${s.cleaningsLimit} used.\n` +
        (s.unusedPreventiveValue > 0
          ? `\n⚠️ You have **${money(s.unusedPreventiveValue)}** of free preventive care unused. It resets ${plan.benefitPeriod.split("–")[1]?.trim() ?? "at year end"} — don't let it expire.`
          : `\nYou've used all your preventive visits — nice.`)
      return { text, tools, learned }
    }

    case "year": {
      tools.push({ name: "plan_year_schedule", status: "done" })
      const y = yearPlanS2()
      const text =
        `I sequenced your treatment across the plan year, ${firstName}:\n\n` +
        `• **Everything now:** you pay ${money(y.everythingNowYouPay)}.\n` +
        `• **Optimized:** you pay ${money(y.optimizedYouPay)}.\n` +
        `• **You save ${money(y.savings)}.**\n\n` +
        y.summary
      return { text: withDisclaimer(text), tools, learned }
    }

    case "history": {
      tools.push({ name: "get_history", status: "done" })
      if (profile.history.length === 0) {
        return { text: `I don't have any past procedures on file for you yet, ${firstName}.`, tools, learned }
      }
      const lines = profile.history
        .map((h) => `• ${h.procedureName} — you paid ${money(h.youPaid)}, plan paid ${money(h.planPaid)}`)
        .join("\n")
      return {
        text: `Here's your dental history on file, ${firstName}:\n\n${lines}`,
        tools,
        learned,
      }
    }

    case "mustHave": {
      tools.push({ name: "search_plan_docs", status: "done" })
      const ortho = plan.services.find((s) => s.category === "ortho")
      const text = ortho
        ? `Your plan does cover **${ortho.name.toLowerCase()}** — ${ortho.notes ?? ""} ${ortho.ageLimit ?? ""} ${ortho.frequency}.`.trim()
        : `This plan doesn't list orthodontics. If braces are a must-have, that's worth weighing at open enrollment.`
      return {
        text: withDisclaimer(text),
        tools,
        learned: appendPreference(learned, profile, "Interested in orthodontics / must-have coverage."),
      }
    }

    default:
      return {
        text:
          `I can help with your ${plan.name}, ${firstName}. Try: "What will a crown cost?", ` +
          `"What if I wait until January?", "What do I have left this year?", or "Plan my year".`,
        tools,
        learned,
      }
  }
}

const DISCLAIMER =
  "\n\n_This is an estimate. Your actual cost depends on your dentist's charges and claim review._"

function withDisclaimer(text: string): string {
  return text + DISCLAIMER
}

function appendHighlight(l: Partial<AiContext>, p: Profile, s: string): Partial<AiContext> {
  return { ...l, planHighlights: dedupeTail([...p.aiContext.planHighlights, s]) }
}
function appendProcedure(l: Partial<AiContext>, p: Profile, s: string): Partial<AiContext> {
  return { ...l, previousProcedures: dedupeTail([...p.aiContext.previousProcedures, s]) }
}
function appendPreference(l: Partial<AiContext>, p: Profile, s: string): Partial<AiContext> {
  return { ...l, preferences: dedupeTail([...p.aiContext.preferences, s]) }
}
function dedupeTail(arr: string[]): string[] {
  return Array.from(new Set(arr)).slice(-6)
}
