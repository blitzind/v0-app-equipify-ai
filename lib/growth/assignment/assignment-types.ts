/** Client-safe Growth Engine lead assignment types (slice 6.17A). */

export const GROWTH_LEAD_ASSIGNMENT_QA_MARKER = "growth-lead-assignment-v1" as const

export const GROWTH_LEAD_ASSIGNMENT_SOURCES = [
  "manual",
  "rule",
  "import",
  "scheduler",
  "manager_override",
] as const

export type GrowthLeadAssignmentSource = (typeof GROWTH_LEAD_ASSIGNMENT_SOURCES)[number]

export const GROWTH_REP_STATUSES = ["active", "paused", "inactive"] as const

export type GrowthRepStatus = (typeof GROWTH_REP_STATUSES)[number]

export const GROWTH_LEAD_ASSIGNMENT_INDUSTRIES = [
  "hvac",
  "medical_equipment",
  "field_service",
  "general",
] as const

export type GrowthLeadAssignmentIndustry = (typeof GROWTH_LEAD_ASSIGNMENT_INDUSTRIES)[number]

export const GROWTH_ASSIGNMENT_DEFAULT_BATCH_SIZE = 25

export type GrowthRepRosterEntry = {
  id: string
  userId: string
  email: string
  displayName: string | null
  status: GrowthRepStatus
  maxActiveLeads: number
  maxDailyNewAssignments: number
  industries: string[]
  territories: string[]
  leadTypes: string[]
  roundRobinOrder: number
  lastAssignedAt: string | null
  activeLeadCount: number
  dailyAssignmentCount: number
  isOverCapacity: boolean
  createdAt: string
  updatedAt: string
}

export type GrowthAssignmentSettings = {
  id: string
  roundRobinEnabled: boolean
  industrySpecializationEnabled: boolean
  territoryMatchingEnabled: boolean
  capacityBalancingEnabled: boolean
  priorityRoutingEnabled: boolean
  roundRobinCursorUserId: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export type GrowthAssignmentRunResult = {
  scanned: number
  assigned: number
  skippedManual: number
  skippedCapacity: number
  skippedNoRep: number
  failed: number
  dryRun: boolean
  qaMarker: typeof GROWTH_LEAD_ASSIGNMENT_QA_MARKER
  runId: string | null
  warnings: string[]
}

export type GrowthAssignmentRunRecord = {
  id: string
  runMode: "live" | "dry_run"
  scanned: number
  assigned: number
  skippedManual: number
  skippedCapacity: number
  skippedNoRep: number
  failed: number
  qaMarker: string
  startedAt: string
  finishedAt: string | null
  createdBy: string | null
}

export type GrowthSalesOwnershipDashboard = {
  qaMarker: typeof GROWTH_LEAD_ASSIGNMENT_QA_MARKER
  totalLeads: number
  unassignedCount: number
  highPriorityUnassignedCount: number
  overCapacityRepCount: number
  leadsByOwner: Array<{
    userId: string
    email: string
    displayName: string | null
    status: GrowthRepStatus
    leadCount: number
    needsActionCount: number
    isOverCapacity: boolean
  }>
  recentActivity: Array<{
    leadId: string
    companyName: string
    eventType: string
    summary: string | null
    occurredAt: string
  }>
  lastRun: GrowthAssignmentRunRecord | null
}

export type GrowthLeadAssignmentView = {
  assignedTo: string | null
  assignedToLabel: string | null
  assignedAt: string | null
  assignedBy: string | null
  assignmentSource: GrowthLeadAssignmentSource | null
}

export const GROWTH_ASSIGNMENT_SOURCE_LABELS: Record<GrowthLeadAssignmentSource, string> = {
  manual: "Manual",
  rule: "Assignment rule",
  import: "Import",
  scheduler: "Scheduler",
  manager_override: "Manager override",
}

/** Sources that block automatic rule reassignment unless manager override is explicit. */
export const GROWTH_ASSIGNMENT_MANUAL_PROTECTED_SOURCES: GrowthLeadAssignmentSource[] = [
  "manual",
  "manager_override",
]
