import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { appendGovernancePolicyEvent } from "@/lib/growth/governance/governance-events"
import type {
  GrowthGovernanceAction,
  GrowthGovernanceEvaluationResult,
  GrowthGovernancePolicy,
  GrowthGovernancePolicyRule,
  GrowthGovernancePolicyViolation,
} from "@/lib/growth/governance/governance-types"
import {
  evaluateRoleCanApprove,
  evaluateRoleCanExport,
  evaluateRoleCanSend,
} from "@/lib/growth/governance/role-restrictions"
import {
  evaluateAiRequiresReview,
  evaluateAllowedSendWindows,
  evaluateApprovalRequiredAboveVolume,
  evaluateMaxDailySends,
  evaluateRestrictedDomain,
  evaluateRestrictedProvider,
  extractDomainFromEmail,
} from "@/lib/growth/governance/sending-policy"

export class GovernancePolicyBlockedError extends Error {
  violations: GrowthGovernancePolicyViolation[]

  constructor(violations: GrowthGovernancePolicyViolation[]) {
    super("governance_policy_blocked")
    this.name = "GovernancePolicyBlockedError"
    this.violations = violations
  }
}

export type GovernanceEvaluationInput = {
  action: GrowthGovernanceAction
  actorUserId: string
  actorEmail: string
  sourceRoute: string
  approvalReason?: string
  entityType?: string
  entityId?: string | null
  recipientEmail?: string
  providerFamily?: string
  dailySendCount?: number
  humanApprovalConfirmed?: boolean
  requiresAiReview?: boolean
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function mapRule(row: Record<string, unknown>): GrowthGovernancePolicyRule {
  return {
    id: asString(row.id),
    policyId: asString(row.policy_id),
    ruleType: asString(row.rule_type) as GrowthGovernancePolicyRule["ruleType"],
    ruleConfig: asRecord(row.rule_config),
    enabled: Boolean(row.enabled ?? true),
    priority: Number(row.priority ?? 100),
  }
}

function mapPolicy(row: Record<string, unknown>, rules: GrowthGovernancePolicyRule[]): GrowthGovernancePolicy {
  return {
    id: asString(row.id),
    name: asString(row.name),
    description: asString(row.description),
    category: asString(row.category) as GrowthGovernancePolicy["category"],
    status: asString(row.status) as GrowthGovernancePolicy["status"],
    version: Number(row.version ?? 1),
    rules,
    activatedAt: asString(row.activated_at) || null,
    pausedAt: asString(row.paused_at) || null,
    updatedAt: asString(row.updated_at),
  }
}

export async function listActiveGovernancePolicies(admin: SupabaseClient): Promise<GrowthGovernancePolicy[]> {
  const { data: policies, error } = await admin
    .schema("growth")
    .from("governance_policies")
    .select("*")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)

  const policyRows = (policies ?? []) as Record<string, unknown>[]
  if (policyRows.length === 0) return []

  const policyIds = policyRows.map((row) => asString(row.id)).filter(Boolean)
  const { data: rules, error: rulesError } = await admin
    .schema("growth")
    .from("governance_policy_rules")
    .select("*")
    .in("policy_id", policyIds)
    .eq("enabled", true)
    .order("priority", { ascending: true })
  if (rulesError) throw new Error(rulesError.message)

  const rulesByPolicy = new Map<string, GrowthGovernancePolicyRule[]>()
  for (const row of (rules ?? []) as Record<string, unknown>[]) {
    const mapped = mapRule(row)
    const list = rulesByPolicy.get(mapped.policyId) ?? []
    list.push(mapped)
    rulesByPolicy.set(mapped.policyId, list)
  }

  return policyRows.map((row) => mapPolicy(row, rulesByPolicy.get(asString(row.id)) ?? []))
}

function evaluateRuleForAction(
  input: GovernanceEvaluationInput,
  policy: GrowthGovernancePolicy,
  rule: GrowthGovernancePolicyRule,
): GrowthGovernancePolicyViolation | null {
  const config = rule.ruleConfig
  const recipientDomain = extractDomainFromEmail(input.recipientEmail)

  switch (rule.ruleType) {
    case "max_daily_sends":
      if (!["sequence_job_run", "reply_draft_send", "provider_send", "provider_test_send"].includes(input.action)) return null
      return evaluateMaxDailySends(input.dailySendCount ?? 0, config)
    case "allowed_send_windows":
      if (!["sequence_job_run", "reply_draft_send", "provider_send"].includes(input.action)) return null
      return evaluateAllowedSendWindows(config)
    case "approval_required_above_volume":
      if (!["sequence_job_run", "reply_draft_send", "provider_send"].includes(input.action)) return null
      return evaluateApprovalRequiredAboveVolume(input.dailySendCount ?? 0, input.humanApprovalConfirmed, config)
    case "restricted_domains":
      return evaluateRestrictedDomain(recipientDomain, config, "restricted_domains")
    case "blocked_recipient_domains":
      return evaluateRestrictedDomain(recipientDomain, config, "blocked_recipient_domains")
    case "restricted_providers":
      return evaluateRestrictedProvider(input.providerFamily, config)
    case "role_can_send":
      if (!["sequence_job_run", "reply_draft_send", "provider_send", "provider_test_send"].includes(input.action)) return null
      return evaluateRoleCanSend(input.actorEmail, config)
        ? null
        : {
            ruleType: "role_can_send",
            policyId: policy.id,
            policyName: policy.name,
            message: "Actor is not permitted to send under role restrictions.",
            severity: "critical",
          }
    case "role_can_approve":
      if (!["sequence_job_approve", "content_template_approve", "content_snippet_approve"].includes(input.action)) return null
      return evaluateRoleCanApprove(input.actorEmail, config)
        ? null
        : {
            ruleType: "role_can_approve",
            policyId: policy.id,
            policyName: policy.name,
            message: "Actor is not permitted to approve under role restrictions.",
            severity: "critical",
          }
    case "role_can_export":
      if (input.action !== "export_generate") return null
      return evaluateRoleCanExport(input.actorEmail, config)
        ? null
        : {
            ruleType: "role_can_export",
            policyId: policy.id,
            policyName: policy.name,
            message: "Actor is not permitted to export under role restrictions.",
            severity: "critical",
          }
    case "ai_requires_review":
      if (!["content_template_approve", "content_snippet_approve", "reply_draft_send"].includes(input.action)) return null
      return evaluateAiRequiresReview(input.requiresAiReview, input.humanApprovalConfirmed)
    default:
      return null
  }
}

export function evaluateGovernancePolicies(
  policies: GrowthGovernancePolicy[],
  input: GovernanceEvaluationInput,
): GrowthGovernanceEvaluationResult {
  const violations: GrowthGovernancePolicyViolation[] = []
  const appliedPolicyIds: string[] = []
  const riskFlags: string[] = []

  for (const policy of policies) {
    if (policy.status !== "active" || policy.rules.length === 0) continue
    appliedPolicyIds.push(policy.id)
    for (const rule of policy.rules) {
      const violation = evaluateRuleForAction(input, policy, rule)
      if (!violation) continue
      violations.push({
        ...violation,
        policyId: policy.id,
        policyName: policy.name,
      })
      riskFlags.push(`${violation.ruleType}:${policy.name}`)
    }
  }

  return {
    allowed: violations.length === 0,
    violations,
    appliedPolicyIds,
    policySnapshot: {
      action: input.action,
      sourceRoute: input.sourceRoute,
      appliedPolicyIds,
      evaluatedAt: new Date().toISOString(),
    },
    riskFlags,
  }
}

export async function evaluateGovernancePolicyContext(
  admin: SupabaseClient,
  input: GovernanceEvaluationInput,
): Promise<GrowthGovernanceEvaluationResult> {
  const policies = await listActiveGovernancePolicies(admin)
  return evaluateGovernancePolicies(policies, input)
}

export async function assertGovernancePolicyAllowed(
  admin: SupabaseClient,
  input: GovernanceEvaluationInput,
): Promise<GrowthGovernanceEvaluationResult> {
  const result = await evaluateGovernancePolicyContext(admin, input)
  if (!result.allowed) {
    for (const violation of result.violations) {
      await appendGovernancePolicyEvent(admin, {
        eventType: "policy_violation",
        policyId: violation.policyId || null,
        severity: violation.severity,
        title: "Governance policy violation",
        description: violation.message,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
        metadata: {
          action: input.action,
          sourceRoute: input.sourceRoute,
          ruleType: violation.ruleType,
        },
      }).catch(() => undefined)
    }
    throw new GovernancePolicyBlockedError(result.violations)
  }
  return result
}

export async function countDailyTransportSends(admin: SupabaseClient): Promise<number> {
  const since = new Date()
  since.setUTCHours(0, 0, 0, 0)
  const { count, error } = await admin
    .schema("growth")
    .from("delivery_attempts")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString())
    .eq("status", "sent")
  if (error) return 0
  return count ?? 0
}

export async function runGovernanceGateWithAudit(
  admin: SupabaseClient,
  input: GovernanceEvaluationInput & {
    entityType: string
    entityId?: string | null
    recordAudit?: boolean
  },
): Promise<GrowthGovernanceEvaluationResult> {
  const dailySendCount =
    input.dailySendCount ??
    (["sequence_job_run", "reply_draft_send", "provider_send", "provider_test_send"].includes(input.action)
      ? await countDailyTransportSends(admin)
      : 0)

  const result = await assertGovernancePolicyAllowed(admin, {
    ...input,
    dailySendCount,
  })

  if (input.recordAudit !== false) {
    const { appendGovernanceApprovalAudit } = await import("@/lib/growth/governance/approval-audit")
    await appendGovernanceApprovalAudit(admin, {
      actorUserId: input.actorUserId,
      actorEmail: input.actorEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      sourceRoute: input.sourceRoute,
      approvalReason: input.approvalReason,
      evaluation: result,
    })
  }

  return result
}

export async function isGovernanceSchemaReadyForEnforcement(admin: SupabaseClient): Promise<boolean> {
  const { isGrowthEnterpriseGovernanceSchemaReady } = await import("@/lib/growth/governance/schema-health")
  return isGrowthEnterpriseGovernanceSchemaReady(admin)
}
