import type { ImpactEvidence } from '@/features/impact-dashboard/types.ts'

type EvidenceListProps = {
  evidence: readonly ImpactEvidence[]
}

export function EvidenceList({ evidence }: EvidenceListProps) {
  return (
    <div className="evidence-list">
      {evidence.map((item) => (
        <a href={item.url} key={item.url} target="_blank" rel="noreferrer">
          <span>
            {item.contributionType} · {item.area}
          </span>
          <strong>{item.title}</strong>
          <p>{item.reason}</p>
          <p>{item.whyItMatters}</p>
        </a>
      ))}
    </div>
  )
}
