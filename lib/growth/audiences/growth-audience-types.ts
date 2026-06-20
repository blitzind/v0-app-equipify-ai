/** GS-RG-2A — Dynamic Audience types (client-safe). */

import type {
  GrowthAudienceRefreshPolicy,
  GrowthAudienceRefreshRunStatus,
} from "@/lib/growth/audiences/growth-audience-config"
import { GROWTH_AUDIENCE_QA_MARKER } from "@/lib/growth/audiences/growth-audience-config"

export type GrowthAudience = {
  id: string
  organizationId: string
  name: string
  description: string | null
  savedSearchId: string
  createdBy: string | null
  lastSnapshotId: string | null
  lastRefreshAt: string | null
  refreshPolicy: GrowthAudienceRefreshPolicy
  createdAt: string
  updatedAt: string
  qaMarker: typeof GROWTH_AUDIENCE_QA_MARKER
  /** Denormalized for list views when joined. */
  memberCount?: number | null
  lastRefreshDurationMs?: number | null
  lastRefreshStatus?: GrowthAudienceRefreshRunStatus | null
}

export type GrowthAudienceSnapshot = {
  id: string
  audienceId: string
  organizationId: string
  memberCount: number
  searchHash: string
  generatedAt: string
  generatedBy: string | null
  generationDurationMs: number | null
  createdAt: string
}

export type GrowthAudienceMember = {
  id: string
  snapshotId: string
  organizationId: string
  leadId: string | null
  companyId: string | null
  fitScore: number | null
  intentScore: number | null
  engagementScore: number | null
  revenueScore: number | null
  createdAt: string
}

export type GrowthAudienceRefreshRun = {
  id: string
  audienceId: string
  organizationId: string
  snapshotId: string | null
  status: GrowthAudienceRefreshRunStatus
  durationMs: number | null
  membersAdded: number
  membersRemoved: number
  rowsRead: number
  rowsWritten: number
  snapshotCursor: string | null
  processedCount: number
  remainingEstimate: number
  error: string | null
  initiatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAudienceSnapshotProgress = {
  refreshRunId: string
  snapshotId: string | null
  status: GrowthAudienceRefreshRunStatus
  processedCount: number
  remainingEstimate: number
  snapshotCursor: string | null
  hasMore: boolean
  memberCount: number
  rowsRead: number
  rowsWritten: number
  durationMs: number | null
  error: string | null
}
