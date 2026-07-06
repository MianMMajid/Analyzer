import type { ImpactScoreBreakdown } from './impact.types.js'

export type DimensionKey = keyof ImpactScoreBreakdown

export const dimensionKeys = [
  'customerValue',
  'technicalLeverage',
  'riskReduction',
  'ownership',
  'collaboration',
] as const satisfies readonly DimensionKey[]

export function createZeroBreakdown(): ImpactScoreBreakdown {
  return {
    customerValue: 0,
    technicalLeverage: 0,
    riskReduction: 0,
    ownership: 0,
    collaboration: 0,
  }
}

export function capScore(score: number): number {
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function recencyMultiplier(date: Date, window: { readonly since: Date; readonly now: Date }): number {
  const total = Math.max(1, window.now.getTime() - window.since.getTime())
  const elapsed = Math.max(0, Math.min(total, date.getTime() - window.since.getTime()))

  return 0.7 + (elapsed / total) * 0.3
}
