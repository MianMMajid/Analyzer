import { appEnvironment } from '@/config/env.ts'
import { ImpactDashboardResponseSchema } from '@repo/impact-contract'
import type { ImpactDashboardResponse } from '@/features/impact-dashboard/types.ts'

// The frontend communicates with the backend over HTTPS JSON in production.
export async function getImpactDashboard(): Promise<ImpactDashboardResponse> {
  const response = await fetch(`${appEnvironment.apiBaseUrl}/api/v1/impact/summary`)

  if (!response.ok) {
    throw new Error(`Impact API failed with status ${response.status}`)
  }

  return ImpactDashboardResponseSchema.parse(await response.json())
}
