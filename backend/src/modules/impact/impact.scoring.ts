import type { ImpactScoreBreakdown, MethodologyDimension } from './impact.types.js'

export const scoringWeights = {
  customerValue: 0.3,
  technicalLeverage: 0.25,
  riskReduction: 0.2,
  ownership: 0.15,
  collaboration: 0.1,
} satisfies Record<keyof ImpactScoreBreakdown, number>

const dimensionDescriptions = {
  customerValue: 'Product-visible work, user-facing fixes, and changes tied to adoption or retention.',
  technicalLeverage: 'Platform, infrastructure, test, build, observability, and developer productivity work.',
  riskReduction: 'Reliability, security, data integrity, migrations, regressions, and operational fixes.',
  ownership: 'Sustained responsibility across important areas rather than isolated activity spikes.',
  collaboration: 'Reviewing, unblocking, and contributing across team or product boundaries.',
} satisfies Record<keyof ImpactScoreBreakdown, string>

const dimensionNames = {
  customerValue: 'Customer value',
  technicalLeverage: 'Technical leverage',
  riskReduction: 'Risk reduction',
  ownership: 'Ownership',
  collaboration: 'Collaboration',
} satisfies Record<keyof ImpactScoreBreakdown, string>

// This array is derived from the scoring weights so methodology and scoring
// cannot drift into separate sources of truth.
export const impactDimensions = Object.entries(scoringWeights).map(([key, weight]) => {
  const dimension = key as keyof ImpactScoreBreakdown

  return {
    name: dimensionNames[dimension],
    weight: weight * 100,
    description: dimensionDescriptions[dimension],
  }
}) satisfies readonly MethodologyDimension[]

export const methodologyGuardrails = [
  'Raw lines of code, commit counts, and PR volume are supporting diagnostics only.',
  'Mechanical, generated, vendored, bot-authored, and lockfile-only changes are capped before scoring.',
  'Dashboard reads use a precomputed report and must not call GitHub synchronously.',
] as const

// This helper is the only score calculator, preventing duplicate scoring logic.
export function calculateImpactScore(breakdown: ImpactScoreBreakdown): number {
  const weightedScore = Object.entries(scoringWeights).reduce((total, [key, weight]) => {
    const dimension = key as keyof ImpactScoreBreakdown

    return total + breakdown[dimension] * weight
  }, 0)

  return Math.round(weightedScore)
}
