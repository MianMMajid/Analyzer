import type { ImpactScoreBreakdown } from '@/features/impact-dashboard/types.ts'

type ImpactBreakdownProps = {
  breakdown: ImpactScoreBreakdown
}

const breakdownRows: readonly {
  key: keyof ImpactScoreBreakdown
  label: string
}[] = [
  { key: 'customerValue', label: 'Customer value' },
  { key: 'technicalLeverage', label: 'Technical leverage' },
  { key: 'riskReduction', label: 'Risk reduction' },
  { key: 'ownership', label: 'Ownership' },
  { key: 'collaboration', label: 'Collaboration' },
]

export function ImpactBreakdown({ breakdown }: ImpactBreakdownProps) {
  return (
    <div className="breakdown-list" aria-label="Impact score breakdown">
      {breakdownRows.map(({ key, label }) => {
        const value = breakdown[key]

        return (
          <div className="breakdown-row" key={key}>
            <span>{label}</span>
            <meter min="0" max="100" value={value} />
            <strong>{value}</strong>
          </div>
        )
      })}
    </div>
  )
}
