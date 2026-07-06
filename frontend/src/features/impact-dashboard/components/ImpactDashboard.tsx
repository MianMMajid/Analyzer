import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell.tsx'
import { Section } from '@/components/ui/Section.tsx'
import { appEnvironment } from '@/config/env.ts'
import { getImpactDashboard } from '@/features/impact-dashboard/api/impactApi.ts'
import { EngineerDetailPanel } from '@/features/impact-dashboard/components/EngineerDetailPanel.tsx'
import { EngineerLeaderboard } from '@/features/impact-dashboard/components/EngineerLeaderboard.tsx'
import { MethodologyPanel } from '@/features/impact-dashboard/components/MethodologyPanel.tsx'
import type {
  ImpactDashboardResponse,
  ImpactEngineer,
} from '@/features/impact-dashboard/types.ts'

// The page owns orchestration state while scoring and GitHub ingestion stay on the backend.
export function ImpactDashboard() {
  const [data, setData] = useState<ImpactDashboardResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    getImpactDashboard()
      .then((dashboardData) => {
        if (!isMounted) {
          return
        }

        setData(dashboardData)
        setSelectedEngineerId(dashboardData.engineers[0]?.id ?? null)
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Unknown API error')
        }
      })

    return () => {
      isMounted = false
    }
  }, [])

  const selectedEngineer = useMemo<ImpactEngineer | null>(() => {
    if (data === null || selectedEngineerId === null) {
      return null
    }

    return data.engineers.find((engineer) => engineer.id === selectedEngineerId) ?? null
  }, [data, selectedEngineerId])

  const topEngineers = useMemo(
    () => data?.engineers.slice(0, 5) ?? [],
    [data?.engineers],
  )

  const generatedAtLabel = useMemo(() => {
    if (data === null) {
      return null
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(data.generatedAt))
  }, [data])

  return (
    <AppShell
      eyebrow="PostHog repository analysis"
      title={appEnvironment.appName}
      summary="Impact-first ranking for customer value, technical leverage, risk reduction, ownership, and collaboration."
    >
      {errorMessage !== null && (
        <Section
          id="leaderboard"
          title="API unavailable"
          description="The frontend is running, but the backend impact endpoint did not respond."
        >
          <p className="error-message">{errorMessage}</p>
        </Section>
      )}

      {data === null && errorMessage === null && (
        <Section
          id="leaderboard"
          title="Loading analysis"
          description="Fetching the precomputed impact report from the backend."
        >
          <p className="loading-message">Loading impact report...</p>
        </Section>
      )}

      {data !== null && selectedEngineer !== null && (
        <>
          <div className="insight-strip" aria-label="Dashboard context">
            <div className="insight-strip__item">
              <span>Repository</span>
              <strong>{data.repository}</strong>
            </div>
            <div className="insight-strip__item">
              <span>Window</span>
              <strong>{data.analysisWindow.label}</strong>
            </div>
            <div className="insight-strip__item">
              <span>Freshness</span>
              <strong>{generatedAtLabel}</strong>
            </div>
            <div className="insight-strip__item">
              <span>Confidence</span>
              <strong>{selectedEngineer.confidence}</strong>
            </div>
            <div className="insight-strip__item">
              <span>Data source</span>
              <strong>{data.dataFreshness.source.replace('_', ' ')}</strong>
            </div>
          </div>

          <Section
            id="leaderboard"
            title="Top 5 impactful engineers"
            description="Scores favor contribution patterns that made PostHog better, safer, faster, or easier to build."
          >
            <div className="dashboard-grid">
              <EngineerLeaderboard
                engineers={topEngineers}
                selectedEngineerId={selectedEngineer.id}
                onSelectEngineer={setSelectedEngineerId}
              />
              <EngineerDetailPanel engineer={selectedEngineer} />
            </div>
          </Section>

          <Section
            id="posthog-value"
            title="Why it matters to PostHog"
            description="The model highlights product and platform work that compounds for an open-source analytics company."
          >
            <div className="why-grid">
              <p>
                Customer-facing analytics, ingestion correctness, query performance,
                and reliability work carry more weight than raw PR volume.
              </p>
              <p>
                The selected engineer view connects each rank to concrete evidence, so
                leaders can distinguish durable ownership from activity spikes.
              </p>
            </div>
          </Section>

          <Section
            id="methodology"
            title="Methodology"
            description="The backend owns this scoring model so every client sees the same ranked result."
          >
            <MethodologyPanel
              dimensions={data.methodology.dimensions}
              guardrails={data.methodology.guardrails}
              summary={data.methodology.summary}
            />
          </Section>
        </>
      )}
    </AppShell>
  )
}
