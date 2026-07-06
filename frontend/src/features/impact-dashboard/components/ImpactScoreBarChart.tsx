import { useId, useRef, type KeyboardEvent } from 'react'
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
  const descriptionId = useId()
  const titleId = useId()
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([])
  const dimensionLabel = getDimensionLabel(dimensionFilter)
  const selectedEngineer = engineers.find((engineer) => engineer.id === selectedEngineerId)
  const selectedScore =
    selectedEngineer === undefined ? null : getDimensionScore(selectedEngineer, dimensionFilter)
  const maxScore = Math.max(...engineers.map((engineer) => getDimensionScore(engineer, dimensionFilter)), 100)

  function moveSelection(nextIndex: number) {
    const nextEngineer = engineers[nextIndex]

    if (nextEngineer === undefined) {
      return
    }

    onSelectEngineer(nextEngineer.id)
    window.requestAnimationFrame(() => buttonRefs.current[nextIndex]?.focus())
  }

  function handleBarKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveSelection(Math.max(0, index - 1))
    }

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      moveSelection(Math.min(engineers.length - 1, index + 1))
    }

    if (event.key === 'Home') {
      event.preventDefault()
      moveSelection(0)
    }

    if (event.key === 'End') {
      event.preventDefault()
      moveSelection(engineers.length - 1)
    }
  }

  return (
    <div className="chart-panel glass-panel" aria-labelledby={titleId} aria-describedby={descriptionId}>
      <div className="chart-panel__header">
        <span>Score distribution</span>
        <strong id={titleId}>{dimensionLabel}</strong>
      </div>
      <p className="sr-only" id={descriptionId}>
        {selectedEngineer === undefined || selectedScore === null
          ? `Top engineers sorted by ${dimensionLabel} score.`
          : `Top engineers sorted by ${dimensionLabel} score. ${selectedEngineer.name} is selected with a score of ${selectedScore}.`}
      </p>
      <ol className="bar-chart" aria-label="Engineer score distribution">
        {engineers.map((engineer, index) => {
          const score = getDimensionScore(engineer, dimensionFilter)
          const height = `${Math.max(12, (score / maxScore) * 100)}%`
          const isSelected = engineer.id === selectedEngineerId

          return (
            <li className="bar-chart__slot" key={engineer.id}>
              <button
                aria-label={`${isSelected ? 'Selected' : 'Select'} ${engineer.name}, ${dimensionLabel} score ${score}`}
                aria-pressed={isSelected}
                className="bar-chart__item"
                data-selected={isSelected}
                onClick={() => onSelectEngineer(engineer.id)}
                onKeyDown={(event) => handleBarKeyDown(event, index)}
                ref={(node) => {
                  buttonRefs.current[index] = node
                }}
                title={`${engineer.name}: ${score} ${dimensionLabel}`}
                type="button"
              >
                <span className="bar-chart__value">{score}</span>
                <span className="bar-chart__bar" style={{ height }} />
                <span className="bar-chart__label">{engineer.name}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
