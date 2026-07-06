import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'
import { DashboardFilters } from './DashboardFilters.tsx'
import type { ImpactEngineer } from '@/features/impact-dashboard/types.ts'

const engineers = [
  {
    id: 'ada',
    name: 'Ada Lovelace',
    githubLogin: 'ada',
    rank: 1,
    totalScore: 95,
    primaryImpactArea: 'Analytics',
    primaryContributionTheme: 'Customer value',
    areas: ['Analytics', 'Frontend'],
    breakdown: {
      customerValue: 95,
      technicalLeverage: 80,
      riskReduction: 70,
      ownership: 75,
      collaboration: 60,
    },
    explanation: 'Strong impact',
    riskQualityNote: 'Strong quality signal',
    confidence: 'high',
    evidence: [],
  },
  {
    id: 'grace',
    name: 'Grace Hopper',
    githubLogin: 'grace',
    rank: 2,
    totalScore: 88,
    primaryImpactArea: 'CI and testing',
    primaryContributionTheme: 'Technical leverage',
    areas: ['CI and testing'],
    breakdown: {
      customerValue: 70,
      technicalLeverage: 92,
      riskReduction: 82,
      ownership: 74,
      collaboration: 68,
    },
    explanation: 'Strong impact',
    riskQualityNote: 'Strong quality signal',
    confidence: 'medium',
    evidence: [],
  },
] satisfies readonly ImpactEngineer[]

describe('DashboardFilters', () => {
  it('renders unique filter options and emits filter changes', async () => {
    const container = document.createElement('div')
    const root = createRoot(container)
    const onAreaFilterChange = vi.fn()
    const onConfidenceFilterChange = vi.fn()
    const onDimensionFilterChange = vi.fn()

    await act(async () => {
      root.render(
        <DashboardFilters
          areaFilter="all"
          confidenceFilter="all"
          dimensionFilter="all"
          engineers={engineers}
          onAreaFilterChange={onAreaFilterChange}
          onConfidenceFilterChange={onConfidenceFilterChange}
          onDimensionFilterChange={onDimensionFilterChange}
        />,
      )
    })

    expect([...container.querySelectorAll('option')].map((option) => option.textContent)).toEqual([
      'All areas',
      'Analytics',
      'CI and testing',
      'Frontend',
      'All confidence',
      'high',
      'medium',
    ])

    const areaSelect = container.querySelector('select')
    expect(areaSelect).not.toBeNull()

    await act(async () => {
      areaSelect!.value = 'Analytics'
      areaSelect!.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(onAreaFilterChange).toHaveBeenCalledWith('Analytics')

    const technicalLeverageButton = [...container.querySelectorAll('button')].find(
      (button) => button.textContent === 'Leverage',
    )
    expect(technicalLeverageButton).toBeDefined()

    await act(async () => {
      technicalLeverageButton!.click()
    })

    expect(onDimensionFilterChange).toHaveBeenCalledWith('technicalLeverage')

    await act(async () => {
      root.unmount()
    })
  })
})
