import { StatusCard } from '@/components/ui/StatusCard.tsx'
import type { MethodologyDimension } from '@/features/impact-dashboard/types.ts'

type MethodologyPanelProps = {
  dimensions: readonly MethodologyDimension[]
  guardrails: readonly string[]
  summary: string
}

export function MethodologyPanel({
  dimensions,
  guardrails,
  summary,
}: MethodologyPanelProps) {
  return (
    <div className="methodology-layout">
      <p className="methodology-summary">{summary}</p>
      <ul className="guardrail-list">
        {guardrails.map((guardrail) => (
          <li key={guardrail}>{guardrail}</li>
        ))}
      </ul>
      <div className="status-grid">
        {dimensions.map((dimension) => (
          <StatusCard
            description={dimension.description}
            key={dimension.name}
            title={dimension.name}
            value={`${dimension.weight}%`}
          />
        ))}
      </div>
    </div>
  )
}
