import type { ImpactEngineer, ImpactScoreBreakdown } from '@/features/impact-dashboard/types.ts'

export type DimensionFilter = keyof ImpactScoreBreakdown | 'all'

export const impactScoreDimensions: readonly { key: DimensionFilter; label: string }[] = [
  { key: 'all', label: 'Overall' },
  { key: 'customerValue', label: 'Customer' },
  { key: 'technicalLeverage', label: 'Leverage' },
  { key: 'riskReduction', label: 'Risk' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'collaboration', label: 'Collab' },
]

export function getDimensionScore(engineer: ImpactEngineer, dimension: DimensionFilter): number {
  return dimension === 'all' ? engineer.totalScore : engineer.breakdown[dimension]
}

export function getDimensionLabel(dimension: DimensionFilter): string {
  return impactScoreDimensions.find((item) => item.key === dimension)?.label ?? 'Overall'
}
