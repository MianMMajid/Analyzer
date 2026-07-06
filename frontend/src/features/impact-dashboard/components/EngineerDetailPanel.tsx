import { EvidenceList } from '@/features/impact-dashboard/components/EvidenceList.tsx'
import { ImpactBreakdown } from '@/features/impact-dashboard/components/ImpactBreakdown.tsx'
import type { ImpactEngineer } from '@/features/impact-dashboard/types.ts'

type EngineerDetailPanelProps = {
  engineer: ImpactEngineer
}

// This panel explains the why behind the score, which matters more than raw counts.
export function EngineerDetailPanel({ engineer }: EngineerDetailPanelProps) {
  return (
    <article className="detail-panel glass-panel" id="evidence">
      <div className="detail-panel__header">
        <div>
          <p className="eyebrow">Selected engineer</p>
          <h2>{engineer.name}</h2>
          <p>
            @{engineer.githubLogin} · {engineer.primaryImpactArea}
          </p>
        </div>
        <strong aria-label={`${engineer.totalScore} total impact score`}>{engineer.totalScore}</strong>
      </div>

      <p className="detail-panel__summary">{engineer.explanation}</p>

      <div className="impact-context">
        <div>
          <span>Primary theme</span>
          <p>{engineer.primaryContributionTheme}</p>
        </div>
        <div>
          <span>Risk / quality note</span>
          <p>{engineer.riskQualityNote}</p>
        </div>
        <div>
          <span>Confidence</span>
          <p>{engineer.confidence}</p>
        </div>
      </div>

      <ImpactBreakdown breakdown={engineer.breakdown} />

      <div className="detail-panel__section-heading">
        <h3>Representative evidence</h3>
        <p>PRs and contribution themes selected by the backend report.</p>
      </div>

      <EvidenceList evidence={engineer.evidence} />
    </article>
  )
}
