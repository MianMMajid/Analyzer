import { describe, expect, it } from 'vitest'
import { calculateImpactScore, impactDimensions, scoringWeights } from './impact.scoring.js'

describe('impact scoring', () => {
  it('keeps methodology weights aligned to the scoring weights', () => {
    const totalWeight = Object.values(scoringWeights).reduce((sum, weight) => sum + weight, 0)
    const methodologyWeight = impactDimensions.reduce((sum, dimension) => sum + dimension.weight, 0)

    expect(totalWeight).toBe(1)
    expect(methodologyWeight).toBe(100)
  })

  it('calculates a weighted impact score', () => {
    expect(
      calculateImpactScore({
        customerValue: 100,
        technicalLeverage: 80,
        riskReduction: 60,
        ownership: 40,
        collaboration: 20,
      }),
    ).toBe(70)
  })
})
