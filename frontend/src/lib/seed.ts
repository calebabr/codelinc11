// Seed data for the prototype. Numbers come straight from the demo plan and
// golden scenarios in docs/FEATURES.md §2 so the chatbot's answers line up
// with the rest of the planned app.

import type { Account, Plan, Procedure, Profile } from "./types"

export const DEMO_PPO: Plan = {
  id: "demo_ppo",
  name: "Dental PPO",
  monthlyPremium: 34,
  planYearStart: "January 1",
  deductible: 50,
  deductibleWaivedFor: ["preventive"],
  annualMax: 1500,
  coinsurance: { preventive: 1.0, basic: 0.8, major: 0.5, ortho: 0.5 },
  coverageTier: "employee_family",
  benefitPeriod: "Jan 1 – Dec 31",
  dependentAgeLimit: 26,
  fullTimeStudentAgeLimit: 26,
  services: [
    {
      code: "D1110",
      name: "Cleaning (adult)",
      category: "preventive",
      frequency: "2 per plan year",
      notes: "Deductible waived. Plan pays 100%.",
    },
    {
      code: "D0120",
      name: "Routine exam",
      category: "preventive",
      frequency: "2 per plan year",
      notes: "Deductible waived.",
    },
    {
      code: "D2392",
      name: "Filling, 2-surface (composite)",
      category: "basic",
      frequency: "As needed",
      notes: "Plan pays 80% after deductible.",
    },
    {
      code: "D3330",
      name: "Root canal, molar",
      category: "basic",
      frequency: "1 per tooth",
      notes: "Plan pays 80% after deductible.",
    },
    {
      code: "D2740",
      name: "Crown, porcelain/ceramic",
      category: "major",
      frequency: "1 per tooth every 5 years",
      notes: "Plan pays 50% after deductible.",
    },
    {
      code: "D8080",
      name: "Braces (comprehensive ortho)",
      category: "ortho",
      ageLimit: "Up to age 19",
      frequency: "Lifetime max $1,500",
      notes: "Dependent children only.",
    },
  ],
}

export const DEMO_HMO: Plan = {
  id: "demo_hmo",
  name: "Dental HMO (lower premium)",
  monthlyPremium: 18,
  planYearStart: "January 1",
  deductible: 0,
  deductibleWaivedFor: ["preventive", "basic", "major"],
  annualMax: 1000,
  coinsurance: { preventive: 1.0, basic: 0.7, major: 0.4, ortho: 0.4 },
  coverageTier: "employee",
  benefitPeriod: "Jan 1 – Dec 31",
  dependentAgeLimit: 26,
  fullTimeStudentAgeLimit: 26,
  services: [
    {
      code: "D1110",
      name: "Cleaning (adult)",
      category: "preventive",
      frequency: "2 per plan year",
      notes: "No deductible. Plan pays 100%.",
    },
    {
      code: "D2392",
      name: "Filling, 2-surface (composite)",
      category: "basic",
      frequency: "As needed",
      notes: "Plan pays 70%. In-network dentists only.",
    },
    {
      code: "D2740",
      name: "Crown, porcelain/ceramic",
      category: "major",
      frequency: "1 per tooth every 5 years",
      notes: "Plan pays 40%. In-network dentists only.",
    },
  ],
}

export const PLANS: Plan[] = [DEMO_PPO, DEMO_HMO]

export const PROCEDURES: Procedure[] = [
  {
    code: "D1110",
    name: "Cleaning (adult)",
    category: "preventive",
    synonyms: ["cleaning", "teeth cleaning", "prophylaxis", "regular cleaning"],
    typicalFee: 120,
    outOfNetworkBilled: 160,
  },
  {
    code: "D2392",
    name: "Filling, 2-surface, back tooth (composite)",
    category: "basic",
    synonyms: ["filling", "cavity", "composite", "white filling", "fill a cavity"],
    typicalFee: 200,
    outOfNetworkBilled: 260,
  },
  {
    code: "D3330",
    name: "Root canal, molar",
    category: "basic",
    synonyms: ["root canal", "nerve treatment", "endodontics"],
    typicalFee: 1100,
    outOfNetworkBilled: 1400,
  },
  {
    code: "D2740",
    name: "Crown, porcelain/ceramic",
    category: "major",
    synonyms: ["crown", "cap", "cap on my tooth", "cap on my back tooth", "porcelain crown"],
    typicalFee: 1200,
    outOfNetworkBilled: 1500,
  },
]

// A family of profiles under one plan — demonstrates per-profile AI context.
export const SEED_PROFILES: Profile[] = [
  {
    id: "p_alex",
    name: "Alex Rivera",
    relationship: "self",
    age: 38,
    isFullTimeStudent: false,
    planId: "demo_ppo",
    usage: {
      maxUsed: 1100,
      deductibleMet: 50,
      cleaningsUsed: 1,
      cleaningsLimit: 2,
      visitsUsed: 1,
      visitsPerYear: 2,
    },
    history: [
      {
        id: "h1",
        date: "2026-03-14",
        procedureName: "Cleaning (adult)",
        code: "D1110",
        youPaid: 0,
        planPaid: 120,
      },
      {
        id: "h2",
        date: "2026-07-02",
        procedureName: "Filling, 2-surface",
        code: "D2392",
        youPaid: 80,
        planPaid: 120,
      },
      {
        id: "h3",
        date: "2026-09-20",
        procedureName: "Root canal, molar (partial)",
        code: "D3330",
        youPaid: 220,
        planPaid: 880,
      },
      {
        id: "h4",
        date: "2026-09-28",
        procedureName: "Crown, porcelain/ceramic",
        code: "D2740",
        youPaid: 800,
        planPaid: 400,
      },
    ],
    mustHaves: ["major services (crowns)", "root canals"],
    schedule: [
      {
        id: "e1",
        title: "Crown fitting (recommended Jan)",
        date: "2027-01-12",
        kind: "procedure",
        note: "Waiting until the new plan year saves $175.",
      },
      {
        id: "e2",
        title: "2nd cleaning of 2026",
        date: "2026-11-18",
        kind: "cleaning",
        note: "Still covered 100% — don't let it expire.",
      },
      {
        id: "e3",
        title: "Benefits reset reminder",
        date: "2026-12-31",
        kind: "reminder",
        note: "$400 of annual max left this year.",
      },
    ],
    aiContext: {
      planHighlights: [
        "Dental PPO: $1,500 annual max, $50 deductible (waived for cleanings).",
        "$400 of the annual max is left for 2026.",
      ],
      previousProcedures: ["Cleaning (Mar)", "Filling (Jul)", "Root canal started (Sep)"],
      previousQuestions: ["How much is a crown right now?"],
      preferences: ["Prefers to minimize out-of-pocket cost over speed."],
    },
  },
  {
    id: "p_sam",
    name: "Sam Rivera",
    relationship: "spouse",
    age: 36,
    isFullTimeStudent: false,
    planId: "demo_ppo",
    usage: {
      maxUsed: 0,
      deductibleMet: 0,
      cleaningsUsed: 0,
      cleaningsLimit: 2,
      visitsUsed: 0,
      visitsPerYear: 2,
    },
    history: [],
    mustHaves: ["preventive"],
    schedule: [
      {
        id: "e1",
        title: "First cleaning of the year",
        date: "2026-10-21",
        kind: "cleaning",
        note: "Covered 100%.",
      },
    ],
    aiContext: {
      planHighlights: ["Dental PPO: full $1,500 annual max still available."],
      previousProcedures: [],
      previousQuestions: [],
      preferences: [],
    },
  },
  {
    id: "p_jordan",
    name: "Jordan Rivera",
    relationship: "child",
    age: 15,
    isFullTimeStudent: true,
    planId: "demo_ppo",
    usage: {
      maxUsed: 240,
      deductibleMet: 50,
      cleaningsUsed: 2,
      cleaningsLimit: 2,
      visitsUsed: 2,
      visitsPerYear: 2,
    },
    history: [
      {
        id: "h1",
        date: "2026-02-10",
        procedureName: "Cleaning (adult)",
        code: "D1110",
        youPaid: 0,
        planPaid: 120,
      },
      {
        id: "h2",
        date: "2026-08-05",
        procedureName: "Cleaning (adult)",
        code: "D1110",
        youPaid: 0,
        planPaid: 120,
      },
    ],
    mustHaves: ["orthodontics (braces)"],
    schedule: [
      {
        id: "e1",
        title: "Orthodontist consult",
        date: "2026-11-30",
        kind: "procedure",
        note: "Braces covered up to age 19 on this plan.",
      },
    ],
    aiContext: {
      planHighlights: [
        "Covered as a dependent (age limit 26, or 26 for full-time students).",
        "Both cleanings for 2026 are already used.",
      ],
      previousProcedures: ["Cleaning (Feb)", "Cleaning (Aug)"],
      previousQuestions: ["Are braces covered?"],
      preferences: ["Interested in orthodontics."],
    },
  },
]

// The account: one subscriber (Alex) with their covered dependents, all under a
// single unique user_id. This is the top-level record the chatbot is handed.
export const SEED_ACCOUNTS: Account[] = [
  {
    userId: "usr_8821",
    subscriberName: "Alex Rivera",
    planId: "demo_ppo",
    planTier: "premium",
    coverageType: "PPO",
    members: SEED_PROFILES,
  },
]

export const DEFAULT_USER_ID = SEED_ACCOUNTS[0].userId
