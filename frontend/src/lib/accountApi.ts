// Account retrieval + eligibility engine for the prototype.
//
// This models the backend rule from the product notes:
//
//   "keep each client's data separated by a unique user_id, and only retrieve
//    the records belonging to the authenticated user."
//
// getAccountByUserId(userId) is the ONLY way the chatbot reaches account data.
// It returns records for exactly that id and nothing else — the same isolation
// a real backend enforces (WHERE user_id = :authenticated_user). The chatbot is
// handed a user_id, looks the account up here, and answers from what it finds.

import type {
  Account,
  AccountEligibility,
  Category,
  MemberEligibility,
  Plan,
  Profile,
} from "./types"
import { SEED_ACCOUNTS } from "./seed"
import { getPlan } from "./mockApi"

/**
 * Retrieve the account for a user_id. Returns undefined if no account belongs
 * to that id. Never returns another user's record — this is the data-isolation
 * boundary.
 */
export function getAccountByUserId(
  userId: string,
  accounts: Account[] = SEED_ACCOUNTS,
): Account | undefined {
  if (!userId) return undefined
  return accounts.find((a) => a.userId === userId)
}

/** Look up one covered person on an account, by profile id. */
export function getMember(account: Account, profileId: string): Profile | undefined {
  return account.members.find((m) => m.id === profileId)
}

/** Which category a procedure code falls into, from the plan's service list. */
function categoryForCode(plan: Plan, code: string): Category | undefined {
  return plan.services.find((s) => s.code === code)?.category
}

/** Is a dependent still eligible for coverage, given age / student status? */
export function memberEligibility(member: Profile, plan: Plan): MemberEligibility {
  const limit = member.isFullTimeStudent ? plan.fullTimeStudentAgeLimit : plan.dependentAgeLimit

  let eligible = true
  let reason: string
  if (member.relationship === "self") {
    eligible = true
    reason = "Subscriber — always covered."
  } else if (member.relationship === "spouse") {
    eligible = true
    reason = "Spouse — covered with no age limit."
  } else {
    // child / dependent
    eligible = member.age <= limit
    if (eligible) {
      reason = member.isFullTimeStudent
        ? `Covered as a full-time student (up to age ${limit}).`
        : `Covered as a dependent child (up to age ${limit}).`
    } else {
      reason = `No longer eligible — past the dependent age limit of ${limit}.`
    }
  }

  // Major work done this plan year (category "major" in history).
  const majorWorkThisYear = member.history
    .filter((h) => categoryForCode(plan, h.code) === "major")
    .map((h) => h.procedureName)

  const visitsLeft = Math.max(0, member.usage.visitsPerYear - member.usage.visitsUsed)

  return {
    id: member.id,
    name: member.name,
    relationship: member.relationship,
    age: member.age,
    isFullTimeStudent: member.isFullTimeStudent,
    eligible,
    eligibilityReason: reason,
    ageLimit: limit,
    visitsUsed: member.usage.visitsUsed,
    visitsPerYear: member.usage.visitsPerYear,
    visitsLeft,
    hadMajorWorkThisYear: majorWorkThisYear.length > 0,
    majorWorkThisYear,
  }
}

/**
 * The full "know your profile" snapshot the chatbot retrieves for an account:
 * plan tier, coverage type, who's covered, visits per person per year, major
 * work this year, and per-dependent eligibility.
 */
export function eligibilitySummary(account: Account): AccountEligibility {
  const plan = getPlan(account.planId)
  return {
    userId: account.userId,
    subscriberName: account.subscriberName,
    planName: plan.name,
    planTier: account.planTier,
    coverageType: account.coverageType,
    coveredCount: account.members.filter((m) => memberEligibility(m, plan).eligible).length,
    members: account.members.map((m) => memberEligibility(m, plan)),
  }
}
