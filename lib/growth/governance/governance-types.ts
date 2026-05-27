/** Client-safe Growth Engine enterprise governance types (Phase 2U). */

export const GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER = "growth-enterprise-governance-v1" as const

export const GROWTH_ENTERPRISE_GOVERNANCE_PRIVACY_NOTE =
  "Enterprise governance is enforced server-side only. No autonomous send changes, no hidden policy mutation, no compliance bypass, no raw secrets or provider payloads in exports."

export const GROWTH_GOVERNANCE_POLICY_CATEGORIES = [
  "sending",
  "approval",
  "role_access",
  "provider",
  "domain",
  "compliance",
  "retention",
  "export",
  "sequence",
  "ai_generation",
] as const
export type GrowthGovernancePolicyCategory = (typeof GROWTH_GOVERNANCE_POLICY_CATEGORIES)[number]

export const GROWTH_GOVERNANCE_POLICY_STATUSES = ["draft", "active", "paused", "archived"] as const
export type GrowthGovernancePolicyStatus = (typeof GROWTH_GOVERNANCE_POLICY_STATUSES)[number]

export const GROWTH_GOVERNANCE_RULE_TYPES = [
  "max_daily_sends",
  "allowed_send_windows",
  "approval_required_above_volume",
  "restricted_domains",
  "restricted_providers",
  "blocked_recipient_domains",
  "role_can_send",
  "role_can_approve",
  "role_can_export",
  "ai_requires_review",
  "retention_days",
  "legal_hold",
] as const
export type GrowthGovernanceRuleType = (typeof GROWTH_GOVERNANCE_RULE_TYPES)[number]

export const GROWTH_GOVERNANCE_ACTIONS = [
  "sequence_job_approve",
  "sequence_job_run",
  "reply_draft_send",
  "provider_send",
  "provider_test_send",
  "content_template_approve",
  "content_snippet_approve",
  "export_generate",
] as const
export type GrowthGovernanceAction = (typeof GROWTH_GOVERNANCE_ACTIONS)[number]

export const GROWTH_GOVERNANCE_EXPORT_TYPES = [
  "compliance_export",
  "activity_export",
  "suppression_export",
  "approval_audit_export",
  "delivery_audit_export",
] as const
export type GrowthGovernanceExportType = (typeof GROWTH_GOVERNANCE_EXPORT_TYPES)[number]

export type GrowthGovernancePolicyRule = {
  id: string
  policyId: string
  ruleType: GrowthGovernanceRuleType
  ruleConfig: Record<string, unknown>
  enabled: boolean
  priority: number
}

export type GrowthGovernancePolicy = {
  id: string
  name: string
  description: string
  category: GrowthGovernancePolicyCategory
  status: GrowthGovernancePolicyStatus
  version: number
  rules: GrowthGovernancePolicyRule[]
  activatedAt: string | null
  pausedAt: string | null
  updatedAt: string
}

export type GrowthGovernancePolicyViolation = {
  ruleType: GrowthGovernanceRuleType
  policyId: string
  policyName: string
  message: string
  severity: "low" | "medium" | "high" | "critical"
}

export type GrowthGovernanceEvaluationResult = {
  allowed: boolean
  violations: GrowthGovernancePolicyViolation[]
  appliedPolicyIds: string[]
  policySnapshot: Record<string, unknown>
  riskFlags: string[]
}

export type GrowthGovernanceApprovalAuditRecord = {
  id: string
  actorEmail: string
  action: string
  entityType: string
  entityId: string | null
  sourceRoute: string
  approvalReason: string
  riskFlags: string[]
  recordedAt: string
}

export type GrowthGovernanceExportRecord = {
  id: string
  exportType: GrowthGovernanceExportType
  status: "pending" | "processing" | "completed" | "failed"
  fileLabel: string
  rowCount: number
  requestedByEmail: string
  completedAt: string | null
  createdAt: string
}

export type GrowthGovernanceRetentionPolicy = {
  id: string
  scope: "platform" | "audit" | "export" | "delivery" | "activity"
  retentionDays: number
  legalHold: boolean
  status: GrowthGovernancePolicyStatus
  description: string
  updatedAt: string
}

export type GrowthGovernancePolicyEvent = {
  id: string
  eventType: string
  policyId: string | null
  severity: "info" | "low" | "medium" | "high" | "critical"
  title: string
  description: string
  actorEmail: string
  recordedAt: string
}

export type GrowthEnterpriseGovernanceDashboard = {
  qa_marker: typeof GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER
  activePolicies: number
  approvalEvents: number
  exportsGenerated: number
  retentionPolicies: number
  policyViolations: number
  legalHoldCount: number
  policies: GrowthGovernancePolicy[]
  recentAudit: GrowthGovernanceApprovalAuditRecord[]
  recentExports: GrowthGovernanceExportRecord[]
  recentViolations: GrowthGovernancePolicyEvent[]
  retention: GrowthGovernanceRetentionPolicy[]
}

export function sanitizeGovernanceExportValue(value: unknown): unknown {
  if (value == null) return value
  if (typeof value === "string") {
    return value
      .replace(/api[_-]?key[^\s]*/gi, "[redacted]")
      .replace(/password[^\s]*/gi, "[redacted]")
      .replace(/Bearer\s+\S+/gi, "[redacted]")
      .replace(/sk-[a-zA-Z0-9_-]{8,}/g, "[redacted]")
      .slice(0, 500)
  }
  if (Array.isArray(value)) return value.slice(0, 200).map(sanitizeGovernanceExportValue)
  if (typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [key, nested] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
      if (/secret|password|token|credential|payload/i.test(key)) {
        out[key] = "[redacted]"
      } else {
        out[key] = sanitizeGovernanceExportValue(nested)
      }
    }
    return out
  }
  return value
}

export function governanceCategoryLabel(category: GrowthGovernancePolicyCategory): string {
  return category.replace(/_/g, " ")
}

export function governanceRuleTypeLabel(ruleType: GrowthGovernanceRuleType): string {
  return ruleType.replace(/_/g, " ")
}

export function governancePolicyStatusLabel(status: GrowthGovernancePolicyStatus): string {
  return status.replace(/_/g, " ")
}
