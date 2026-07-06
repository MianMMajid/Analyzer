import type { ImpactEngineer } from '@/features/impact-dashboard/types.ts'
import {
  getDimensionLabel,
  getDimensionScore,
  type DimensionFilter,
} from '@/features/impact-dashboard/impactScoreDimensions.ts'

type ImpactScoreBarChartProps = {
  dimensionFilter: DimensionFilter
  engineers: readonly ImpactEngineer[]
  selectedEngineerId: string
  onSelectEngineer: (engineerId: string) => void
}

export function ImpactScoreBarChart({
  dimensionFilter,
  engineers,
  onSelectEngineer,
  selectedEngineerId,
}: ImpactScoreBarChartProps) {
  const maxScore = Math.max(...engineers.map((engineer) => getDimensionScore(engineer, dimensionFilter)), 100)

  return (
    <div className="chart-panel glass-panel">
      <div className="chart-panel__header">
        <span>Score distribution</span>
        <strong>{getDimensionLabel(dimensionFilter)}</strong>
      </div>
      <div className="bar-chart" role="list" aria-label="Clickable engineer score bar chart">
        {engineers.map((engineer) => {
          const score = getDimensionScore(engineer, dimensionFilter)
          const height = `${Math.max(12, (score / maxScore) * 100)}%`

          return (
            <button
              aria-label={`Select ${engineer.name}, score ${score}`}
              aria-pressed={engineer.id === selectedEngineerId}
              className="bar-chart__item"
              data-selected={engineer.id === selectedEngineerId}
              key={engineer.id}
              onClick={() => onSelectEngineer(engineer.id)}
              type="button"
            >
              <span className="bar-chart__value">{score}</span>
              <span className="bar-chart__bar" style={{ height }} />
              <span className="bar-chart__label">{engineer.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
