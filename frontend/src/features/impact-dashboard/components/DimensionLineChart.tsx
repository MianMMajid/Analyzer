import { useId } from 'react'
import type { ImpactEngineer, ImpactScoreBreakdown } from '@/features/impact-dashboard/types.ts'

type DimensionLineChartProps = {
  engineer: ImpactEngineer
}

const dimensions: readonly { key: keyof ImpactScoreBreakdown; label: string }[] = [
  { key: 'customerValue', label: 'Customer' },
  { key: 'technicalLeverage', label: 'Leverage' },
  { key: 'riskReduction', label: 'Risk' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'collaboration', label: 'Collab' },
]

export function DimensionLineChart({ engineer }: DimensionLineChartProps) {
  const descriptionId = useId()
  const titleId = useId()
  const width = 520
  const height = 190
  const padding = 28
  const points = dimensions.map((dimension, index) => {
    const x = padding + (index / (dimensions.length - 1)) * (width - padding * 2)
    const y = height - padding - (engineer.breakdown[dimension.key] / 100) * (height - padding * 2)

    return { ...dimension, x, y, value: engineer.breakdown[dimension.key] }
  })
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const summary = points.map((point) => `${point.label} ${point.value}`).join(', ')

  return (
    <div className="chart-panel glass-panel" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="chart-panel__header">
        <span>Dimension profile</span>
        <strong id={titleId}>{engineer.name}</strong>
      </div>
      <p className="chart-panel__summary" id={descriptionId}>
        {summary}
      </p>
      <svg
        className="line-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${engineer.name} dimension score profile`}
      >
        <title>{engineer.name} dimension score profile</title>
        <desc>{summary}</desc>
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = height - padding - (tick / 100) * (height - padding * 2)
          return (
            <g key={tick}>
              <line className="line-chart__grid" x1={padding} x2={width - padding} y1={y} y2={y} />
              {(tick === 0 || tick === 50 || tick === 100) && (
                <text className="line-chart__axis" x={padding - 10} y={y + 4} textAnchor="end">
                  {tick}
                </text>
              )}
            </g>
          )
        })}
        <path className="line-chart__path" d={path} />
        {points.map((point) => (
          <g key={point.key}>
            <title>{`${point.label}: ${point.value}`}</title>
            <circle className="line-chart__point" cx={point.x} cy={point.y} r="5" />
            <text className="line-chart__value" x={point.x} y={point.y - 10} textAnchor="middle">
              {point.value}
            </text>
            <text className="line-chart__label" x={point.x} y={height - 6} textAnchor="middle">
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
