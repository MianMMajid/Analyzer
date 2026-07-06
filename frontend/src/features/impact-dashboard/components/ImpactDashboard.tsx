import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell.tsx'
import { Section } from '@/components/ui/Section.tsx'
import { appEnvironment } from '@/config/env.ts'
import { ImpactApiError, getImpactDashboard } from '@/features/impact-dashboard/api/impactApi.ts'
import { DashboardFilters } from '@/features/impact-dashboard/components/DashboardFilters.tsx'
import { DimensionLineChart } from '@/features/impact-dashboard/components/DimensionLineChart.tsx'
import { EngineerDetailPanel } from '@/features/impact-dashboard/components/EngineerDetailPanel.tsx'
import { EngineerLeaderboard } from '@/features/impact-dashboard/components/EngineerLeaderboard.tsx'
import { ImpactScoreBarChart } from '@/features/impact-dashboard/components/ImpactScoreBarChart.tsx'
import { getDimensionScore, type DimensionFilter } from '@/features/impact-dashboard/impactScoreDimensions.ts'
import type { ImpactDashboardResponse, ImpactEngineer } from '@/features/impact-dashboard/types.ts'

// The page owns orchestration state while scoring and GitHub ingestion stay on the backend.
export function ImpactDashboard() {
  const [data, setData] = useState<ImpactDashboardResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null)
  const [areaFilter, setAreaFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [dimensionFilter, setDimensionFilter] = useState<DimensionFilter>('all')
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null)
  const [currentTime, setCurrentTime] = useState(() => Date.now())

  useEffect(() => {
    let isMounted = true
    let refreshTimer: number | undefined

    async function loadDashboard(shouldResetSelection: boolean) {
      try {
        const dashboardData = await getImpactDashboard()

        if (!isMounted) {
          return
        }

        setErrorMessage(null)
        setData(dashboardData)
        setLastCheckedAt(Date.now())
        setSelectedEngineerId((currentId) => {
          if (!shouldResetSelection && dashboardData.engineers.some((engineer) => engineer.id === currentId)) {
            return currentId
          }

          return dashboardData.engineers[0]?.id ?? null
        })
      } catch (error: unknown) {
        if (isMounted) {
          setErrorMessage(toDashboardErrorMessage(error))
          setLastCheckedAt(Date.now())
        }
      }
    }

    void loadDashboard(true)
    refreshTimer = window.setInterval(() => {
      void loadDashboard(false)
    }, 60_000)

    return () => {
      isMounted = false
      window.clearInterval(refreshTimer)
    }
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1_000)

    return () => {
      window.clearInterval(timer)
    }
  }, [])

  const visibleEngineers = useMemo(() => {
    const engineers = data?.engineers ?? []

    return [...engineers]
      .filter((engineer) => areaFilter === 'all' || engineer.areas.includes(areaFilter))
      .filter((engineer) => confidenceFilter === 'all' || engineer.confidence === confidenceFilter)
      .sort((left, right) => getDimensionScore(right, dimensionFilter) - getDimensionScore(left, dimensionFilter))
      .slice(0, 5)
  }, [areaFilter, confidenceFilter, data?.engineers, dimensionFilter])

  const selectedEngineer = useMemo<ImpactEngineer | null>(() => {
    const firstVisibleEngineer = visibleEngineers[0]

    if (firstVisibleEngineer === undefined) {
      return null
    }

    return visibleEngineers.find((engineer) => engineer.id === selectedEngineerId) ?? firstVisibleEngineer
  }, [selectedEngineerId, visibleEngineers])

  useEffect(() => {
    const firstVisibleEngineer = visibleEngineers[0]

    if (
      firstVisibleEngineer !== undefined &&
      !visibleEngineers.some((engineer) => engineer.id === selectedEngineerId)
    ) {
      setSelectedEngineerId(firstVisibleEngineer.id)
    }
  }, [selectedEngineerId, visibleEngineers])

  const generatedAtLabel = useMemo(() => {
    if (data === null) {
      return null
    }

    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(data.generatedAt))
  }, [data])

  const freshnessLabel = useMemo(() => {
    if (data === null) {
      return null
    }

    const reportAgeLabel = formatElapsedTime(currentTime - new Date(data.generatedAt).getTime())
    const checkedLabel =
      lastCheckedAt === null ? 'checking' : `checked ${formatElapsedTime(currentTime - lastCheckedAt)}`

    return `Report ${reportAgeLabel} / ${checkedLabel}`
  }, [currentTime, data, lastCheckedAt])

  const hasActiveFilters = areaFilter !== 'all' || confidenceFilter !== 'all' || dimensionFilter !== 'all'

  function resetFilters() {
    setAreaFilter('all')
    setConfidenceFilter('all')
    setDimensionFilter('all')
    setSelectedEngineerId(data?.engineers[0]?.id ?? null)
  }

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

      {data !== null && (
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
              <strong title={generatedAtLabel ?? undefined}>{freshnessLabel}</strong>
            </div>
            <div className="insight-strip__item">
              <span>Confidence</span>
              <strong>{selectedEngineer?.confidence ?? 'No match'}</strong>
            </div>
            <div className="insight-strip__item">
              <span>Data source</span>
              <strong>{data.dataFreshness.source.replaceAll('_', ' ')}</strong>
            </div>
          </div>

          <Section
            id="leaderboard"
            title="Top 5 impactful engineers"
            description="Impact weighs customer value 30%, technical leverage 25%, risk reduction 20%, ownership 15%, and collaboration 10%; raw volume is only supporting context."
          >
            <DashboardFilters
              areaFilter={areaFilter}
              confidenceFilter={confidenceFilter}
              dimensionFilter={dimensionFilter}
              engineers={data.engineers}
              onAreaFilterChange={setAreaFilter}
              onConfidenceFilterChange={setConfidenceFilter}
              onDimensionFilterChange={setDimensionFilter}
            />

            {selectedEngineer === null ? (
              <div className="empty-state glass-panel">
                <p>
                  {data.engineers.length === 0
                    ? 'No engineers were returned by the impact report.'
                    : 'No engineers match the current filters.'}
                </p>
                {hasActiveFilters && (
                  <button type="button" onClick={resetFilters}>
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className="charts-grid">
                  <ImpactScoreBarChart
                    dimensionFilter={dimensionFilter}
                    engineers={visibleEngineers}
                    selectedEngineerId={selectedEngineer.id}
                    onSelectEngineer={setSelectedEngineerId}
                  />
                  <DimensionLineChart engineer={selectedEngineer} />
                </div>

                <div className="dashboard-grid">
                  <EngineerLeaderboard
                    engineers={visibleEngineers}
                    selectedEngineerId={selectedEngineer.id}
                    onSelectEngineer={setSelectedEngineerId}
                  />
                  <EngineerDetailPanel engineer={selectedEngineer} />
                </div>

                <div className="leadership-context glass-panel" id="methodology">
                  <div>
                    <span>Methodology</span>
                    <p>{data.methodology.summary}</p>
                  </div>
                  <div>
                    <span>Guardrails</span>
                    <p>{data.methodology.guardrails.slice(0, 2).join(' ')}</p>
                  </div>
                  <ul aria-label="Impact dimension weights">
                    {data.methodology.dimensions.map((dimension) => (
                      <li key={dimension.name}>
                        <strong>{dimension.weight}%</strong>
                        <span>{dimension.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </Section>
        </>
      )}
    </AppShell>
  )
}

function formatElapsedTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1_000))

  if (seconds < 5) {
    return 'just now'
  }

  if (seconds < 60) {
    return `${seconds}s ago`
  }

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }

  return `${Math.floor(hours / 24)}d ago`
}

function toDashboardErrorMessage(error: unknown): string {
  if (error instanceof ImpactApiError) {
    return `${error.message} [${error.code}]`
  }

  return error instanceof Error ? error.message : 'Unknown API error'
}
