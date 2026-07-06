import { useMemo } from 'react'
import { impactScoreDimensions, type DimensionFilter } from '@/features/impact-dashboard/impactScoreDimensions.ts'
import type { ImpactEngineer } from '@/features/impact-dashboard/types.ts'

type DashboardFiltersProps = {
  areaFilter: string
  confidenceFilter: string
  dimensionFilter: DimensionFilter
  engineers: readonly ImpactEngineer[]
  onAreaFilterChange: (area: string) => void
  onConfidenceFilterChange: (confidence: string) => void
  onDimensionFilterChange: (dimension: DimensionFilter) => void
}

export function DashboardFilters({
  areaFilter,
  confidenceFilter,
  dimensionFilter,
  engineers,
  onAreaFilterChange,
  onConfidenceFilterChange,
  onDimensionFilterChange,
}: DashboardFiltersProps) {
  const areas = useMemo(() => [...new Set(engineers.flatMap((engineer) => engineer.areas))].sort(), [engineers])
  const confidences = useMemo(() => [...new Set(engineers.map((engineer) => engineer.confidence))].sort(), [engineers])

  return (
    <div className="dashboard-filters glass-panel" aria-label="Dashboard filters">
      <label>
        <span>Area</span>
        <select value={areaFilter} onChange={(event) => onAreaFilterChange(event.target.value)}>
          <option value="all">All areas</option>
          {areas.map((area) => (
            <option key={area} value={area}>
              {area}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Confidence</span>
        <select value={confidenceFilter} onChange={(event) => onConfidenceFilterChange(event.target.value)}>
          <option value="all">All confidence</option>
          {confidences.map((confidence) => (
            <option key={confidence} value={confidence}>
              {confidence}
            </option>
          ))}
        </select>
      </label>

      <div className="segmented-control" aria-label="Score dimension">
        {impactScoreDimensions.map((dimension) => (
          <button
            aria-pressed={dimensionFilter === dimension.key}
            data-selected={dimensionFilter === dimension.key}
            key={dimension.key}
            onClick={() => onDimensionFilterChange(dimension.key)}
            type="button"
          >
            {dimension.label}
          </button>
        ))}
      </div>
    </div>
  )
}
