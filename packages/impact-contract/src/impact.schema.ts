import { z } from 'zod'

export const ImpactScoreBreakdownSchema = z.object({
  customerValue: z.number().int().min(0).max(100),
  technicalLeverage: z.number().int().min(0).max(100),
  riskReduction: z.number().int().min(0).max(100),
  ownership: z.number().int().min(0).max(100),
  collaboration: z.number().int().min(0).max(100),
})

export const ImpactEvidenceSchema = z.object({
  title: z.string().min(1),
  url: z.url(),
  reason: z.string().min(1),
  whyItMatters: z.string().min(1),
  contributionType: z.string().min(1),
  area: z.string().min(1),
  kind: z.enum(['pull_request', 'review', 'contribution_theme']),
})

export const ImpactEngineerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  githubLogin: z.string().min(1),
  rank: z.number().int().positive(),
  totalScore: z.number().int().min(0).max(100),
  primaryImpactArea: z.string().min(1),
  primaryContributionTheme: z.string().min(1),
  areas: z.array(z.string().min(1)).readonly(),
  breakdown: ImpactScoreBreakdownSchema,
  explanation: z.string().min(1),
  riskQualityNote: z.string().min(1),
  confidence: z.enum(['high', 'medium', 'low']),
  evidence: z.array(ImpactEvidenceSchema).readonly(),
})

export const MethodologyDimensionSchema = z.object({
  name: z.string().min(1),
  weight: z.number().positive(),
  description: z.string().min(1),
})

export const ImpactDataFreshnessSchema = z.object({
  source: z.enum(['mock_seed', 'github_ingestion']),
  status: z.enum(['fresh', 'stale']),
  generatedAt: z.iso.datetime(),
  lastSuccessfulRefreshAt: z.iso.datetime(),
  nextScheduledRefreshAt: z.iso.datetime().nullable(),
  reportAgeMinutes: z.number().int().min(0),
})

export const ImpactDashboardResponseSchema = z.object({
  repository: z.string().min(1),
  generatedAt: z.iso.datetime(),
  analysisWindow: z.object({
    label: z.string().min(1),
    days: z.number().int().positive(),
    startedAt: z.iso.datetime(),
    endedAt: z.iso.datetime(),
  }),
  dataFreshness: ImpactDataFreshnessSchema,
  methodology: z.object({
    summary: z.string().min(1),
    dimensions: z.array(MethodologyDimensionSchema).readonly(),
    guardrails: z.array(z.string().min(1)).readonly(),
  }),
  engineers: z.array(ImpactEngineerSchema).readonly(),
})

export const ApiErrorSchema = z.object({
  error: z.string().min(1),
  code: z.string().min(1),
  details: z.unknown().optional(),
})

export type ImpactScoreBreakdown = z.infer<typeof ImpactScoreBreakdownSchema>
export type ImpactEvidence = z.infer<typeof ImpactEvidenceSchema>
export type ImpactEngineer = z.infer<typeof ImpactEngineerSchema>
export type MethodologyDimension = z.infer<typeof MethodologyDimensionSchema>
export type ImpactDataFreshness = z.infer<typeof ImpactDataFreshnessSchema>
export type ImpactDashboardResponse = z.infer<typeof ImpactDashboardResponseSchema>
export type ApiError = z.infer<typeof ApiErrorSchema>
