/** GS-RG-2B — Dynamic Audience types (client-safe). */

import type {
  GrowthAudienceDiffStatus,
  GrowthAudienceMemberDiffKind,
  GrowthAudienceRefreshPolicy,
  GrowthAudienceRefreshRunStatus,
  GrowthAudienceResultMode,
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
  refreshIntervalDays: number | null
  nextRefreshAt: string | null
  resultMode: GrowthAudienceResultMode
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
  previousSnapshotId: string | null
  previousMemberCount: number
  addedCount: number
  removedCount: number
  unchangedCount: number
  resultMode: GrowthAudienceResultMode
}

export type GrowthAudienceMember = {
  id: string
  snapshotId: string
  organizationId: string
  memberKey: string | null
  memberKind: "company" | "person"
  leadId: string | null
  companyId: string | null
  growthPersonId: string | null
  canonicalPersonId: string | null
  companyName: string | null
  personName: string | null
  personTitle: string | null
  companyRelationshipJson: Record<string, unknown>
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

export type GrowthAudienceSnapshotDiff = {
  id: string
  audienceId: string
  organizationId: string
  snapshotId: string
  previousSnapshotId: string | null
  status: GrowthAudienceDiffStatus
  previousMemberCount: number
  currentMemberCount: number
  addedCount: number
  removedCount: number
  unchangedCount: number
  rowsRead: number
  rowsWritten: number
  durationMs: number | null
  error: string | null
  createdAt: string
}

export type GrowthAudienceMemberDiff = {
  id: string
  diffId: string
  snapshotId: string
  memberKey: string
  changeKind: GrowthAudienceMemberDiffKind
  memberKind: "company" | "person"
  displayLabel: string | null
  createdAt: string
}

export type GrowthAudienceLeadCreationRun = {
  id: string
  audienceId: string
  organizationId: string
  snapshotId: string
  status: GrowthAudienceRefreshRunStatus
  requestedCount: number
  createdCount: number
  skippedCount: number
  failedCount: number
  rowsRead: number
  rowsWritten: number
  durationMs: number | null
  dryRun: boolean
  error: string | null
  createdAt: string
}

export type GrowthAudienceLeadCreationProgress = {
  runId: string
  status: GrowthAudienceRefreshRunStatus
  requestedCount: number
  createdCount: number
  skippedCount: number
  failedCount: number
  processedCount: number
  hasMore: boolean
  rowsRead: number
  rowsWritten: number
  durationMs: number | null
  error: string | null
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
  addedCount?: number
  removedCount?: number
  unchangedCount?: number
}

export type GrowthAudienceRefreshPolicyUpdate = {
  refreshPolicy: GrowthAudienceRefreshPolicy
}
