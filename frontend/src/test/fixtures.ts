import type { EstimateResponse, EstimateResult, Plan } from '@/lib/types'

export const DEMO_PLAN: Plan = {
  id: 'demo_ppo',
  name: 'Demo PPO',
  description: 'Typical employer dental PPO.',
  monthly_premium: 28,
  deductible: 50,
  deductible_waived_for: ['preventive'],
  annual_max: 1500,
  coinsurance: { preventive: 1, basic: 0.8, major: 0.5 },
  frequency: { D1110: 2, D0120: 2 },
  plan_year_start_month: 1,
}

export const BASIC_PLAN: Plan = {
  ...DEMO_PLAN,
  id: 'basic_ppo',
  name: 'Basic PPO',
  description: 'Lower premium, lower yearly maximum.',
  annual_max: 1000,
  coinsurance: { preventive: 1, basic: 0.7, major: 0.4 },
}

export const CROWN = {
  code: 'D2740',
  name: 'Crown, porcelain/ceramic',
  category: 'major' as const,
  description: 'Tooth cap.',
  synonyms: ['crown', 'cap'],
  fee_p50: 1200,
  fee_p80: 1500,
}

const base: EstimateResult = {
  code: 'D2740',
  name: CROWN.name,
  category: 'major',
  in_network: true,
  covered: true,
  billed: 1200,
  allowed: 1200,
  deductible_applied: 0,
  plan_pays: 400,
  you_pay: 800,
  balance_bill: 0,
  max_used_after: 1500,
  trace: [
    { label: 'Typical cost', amount: 1200, note: 'What dentists in your network usually charge.' },
    { label: 'Your deductible', amount: 0, note: 'Already met.' },
    { label: 'Plan share (50%)', amount: 575, note: 'Your plan pays 50%.' },
    { label: 'Yearly maximum limit', amount: 400, note: 'Only $400 of your maximum is left.' },
    { label: 'You pay', amount: 800, note: 'The rest is yours.' },
  ],
}

/** Golden G3 response: crown, $1,100 of the max used. */
export const G3_RESPONSE: EstimateResponse = {
  in_network: base,
  out_of_network: { ...base, in_network: false, billed: 1500, you_pay: 1100, balance_bill: 300 },
}

const rc = 'Root canal, molar'
const crown = 'Crown, porcelain/ceramic'
const fill = 'Filling, 2 surfaces (composite)'

export const S2_RESPONSE = {
  items: [
    { id: 't1', code: 'D3330', name: rc, category: 'basic', year_offset: 0, month: 11, plan_pays: 400, you_pay: 700, note: 'Urgent, so it stays this year.' },
    { id: 't2', code: 'D2740', name: crown, category: 'major', year_offset: 1, month: 1, plan_pays: 575, you_pay: 625, note: 'Moves to January.' },
    { id: 't3', code: 'D2392', name: fill, category: 'basic', year_offset: 1, month: 2, plan_pays: 160, you_pay: 40, note: 'Next year.' },
    { id: 't4', code: 'D2392', name: fill, category: 'basic', year_offset: 1, month: 3, plan_pays: 160, you_pay: 40, note: 'Next year.' },
  ],
  years: [
    { year_offset: 0, label: 'This plan year', plan_pays: 400, you_pay: 700, max_used_end: 1500, max_remaining_end: 0 },
    { year_offset: 1, label: 'Next plan year', plan_pays: 895, you_pay: 705, max_used_end: 895, max_remaining_end: 605 },
  ],
  total_you_pay: 1405,
  baseline_you_pay: 2300,
  savings: 895,
  baseline_items: [
    { id: 't1', code: 'D3330', name: rc, category: 'basic', year_offset: 0, month: 11, plan_pays: 400, you_pay: 700, note: 'Now.' },
    { id: 't2', code: 'D2740', name: crown, category: 'major', year_offset: 0, month: 12, plan_pays: 0, you_pay: 1200, note: 'Now.' },
    { id: 't3', code: 'D2392', name: fill, category: 'basic', year_offset: 0, month: 12, plan_pays: 0, you_pay: 200, note: 'Now.' },
    { id: 't4', code: 'D2392', name: fill, category: 'basic', year_offset: 0, month: 12, plan_pays: 0, you_pay: 200, note: 'Now.' },
  ],
  reasons: [
    'Root canal stays this year because it is urgent.',
    'Crown moves to January: your plan year resets and you get a fresh $1,500 maximum.',
  ],
}
