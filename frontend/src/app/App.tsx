import { ErrorBoundary } from '@/components/ui/ErrorBoundary.tsx'
import { ImpactDashboard } from '@/features/impact-dashboard/components/ImpactDashboard.tsx'

// App stays intentionally thin so product features own their own behavior.
export function App() {
  return (
    <ErrorBoundary>
      <ImpactDashboard />
    </ErrorBoundary>
  )
}
