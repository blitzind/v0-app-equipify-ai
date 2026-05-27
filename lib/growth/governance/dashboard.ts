import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { listGovernanceApprovalAudit } from "@/lib/growth/governance/approval-audit"
import { appendGovernancePlatformTimelineEvent, appendGovernancePolicyEvent, listGovernancePolicyEvents } from "@/lib/growth/governance/governance-events"
import { listActiveGovernancePolicies } from "@/lib/growth/governance/policy-engine"
import { listGovernanceExports } from "@/lib/growth/governance/export-service"
import {
  GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER,
  type GrowthEnterpriseGovernanceDashboard,
  type GrowthGovernancePolicy,
  type GrowthGovernancePolicyCategory,
  type GrowthGovernancePolicyRule,
  type GrowthGovernanceRetentionPolicy,
  type GrowthGovernanceRuleType,
} from "@/lib/growth/governance/governance-types"

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function policiesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("governance_policies")
}

function rulesTable(admin: SupabaseClient) {
  return admin.schema("growth").from("governance_policy_rules")
}

function retentionTable(admin: SupabaseClient) {
  return admin.schema("growth").from("governance_retention_policies")
}

function mapRule(row: Record<string, unknown>): GrowthGovernancePolicyRule {
  return {
    id: asString(row.id),
    policyId: asString(row.policy_id),
    ruleType: asString(row.rule_type) as GrowthGovernanceRuleType,
    ruleConfig: asRecord(row.rule_config),
    enabled: Boolean(row.enabled ?? true),
    priority: Number(row.priority ?? 100),
  }
}

async function loadPolicyRules(admin: SupabaseClient, policyId: string): Promise<GrowthGovernancePolicyRule[]> {
  const { data, error } = await rulesTable(admin).select("*").eq("policy_id", policyId).order("priority", { ascending: true })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRule)
}

async function mapPolicy(admin: SupabaseClient, row: Record<string, unknown>): Promise<GrowthGovernancePolicy> {
  const rules = await loadPolicyRules(admin, asString(row.id))
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

function mapRetention(row: Record<string, unknown>): GrowthGovernanceRetentionPolicy {
  return {
    id: asString(row.id),
    scope: asString(row.scope) as GrowthGovernanceRetentionPolicy["scope"],
    retentionDays: Number(row.retention_days ?? 365),
    legalHold: Boolean(row.legal_hold),
    status: asString(row.status) as GrowthGovernanceRetentionPolicy["status"],
    description: asString(row.description),
    updatedAt: asString(row.updated_at),
  }
}

export async function listGovernancePolicies(admin: SupabaseClient): Promise<GrowthGovernancePolicy[]> {
  const { data, error } = await policiesTable(admin).select("*").order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return Promise.all(((data ?? []) as Record<string, unknown>[]).map((row) => mapPolicy(admin, row)))
}

export async function getGovernancePolicy(admin: SupabaseClient, policyId: string): Promise<GrowthGovernancePolicy | null> {
  const { data, error } = await policiesTable(admin).select("*").eq("id", policyId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return mapPolicy(admin, data as Record<string, unknown>)
}

export async function createGovernancePolicy(
  admin: SupabaseClient,
  input: {
    name: string
    description?: string
    category: GrowthGovernancePolicyCategory
    actorUserId: string
    actorEmail: string
    rules?: Array<{ ruleType: GrowthGovernanceRuleType; ruleConfig?: Record<string, unknown>; priority?: number }>
  },
): Promise<GrowthGovernancePolicy> {
  const now = new Date().toISOString()
  const { data, error } = await policiesTable(admin)
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() ?? "",
      category: input.category,
      status: "draft",
      created_by: input.actorUserId,
      updated_by: input.actorUserId,
      updated_at: now,
    })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  const policyId = asString((data as Record<string, unknown>).id)
  for (const rule of input.rules ?? []) {
    await rulesTable(admin).insert({
      policy_id: policyId,
      rule_type: rule.ruleType,
      rule_config: rule.ruleConfig ?? {},
      priority: rule.priority ?? 100,
    })
  }

  await appendGovernancePolicyEvent(admin, {
    eventType: "policy_created",
    policyId,
    title: "Governance policy created",
    description: input.name,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
  await appendGovernancePlatformTimelineEvent(admin, {
    eventType: "governance_policy_created",
    title: "Governance policy created",
    summary: input.name,
  })

  const policy = await getGovernancePolicy(admin, policyId)
  if (!policy) throw new Error("policy_create_failed")
  return policy
}

export async function updateGovernancePolicy(
  admin: SupabaseClient,
  policyId: string,
  input: {
    name?: string
    description?: string
    category?: GrowthGovernancePolicyCategory
    actorUserId: string
  },
): Promise<GrowthGovernancePolicy> {
  const patch: Record<string, unknown> = {
    updated_by: input.actorUserId,
    updated_at: new Date().toISOString(),
  }
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.description !== undefined) patch.description = input.description.trim()
  if (input.category !== undefined) patch.category = input.category

  const { error } = await policiesTable(admin).update(patch).eq("id", policyId)
  if (error) throw new Error(error.message)

  const policy = await getGovernancePolicy(admin, policyId)
  if (!policy) throw new Error("policy_not_found")
  return policy
}

export async function activateGovernancePolicy(
  admin: SupabaseClient,
  policyId: string,
  input: { actorUserId: string; actorEmail: string },
): Promise<GrowthGovernancePolicy> {
  const now = new Date().toISOString()
  const { error } = await policiesTable(admin)
    .update({ status: "active", activated_at: now, paused_at: null, updated_by: input.actorUserId, updated_at: now })
    .eq("id", policyId)
  if (error) throw new Error(error.message)

  await appendGovernancePolicyEvent(admin, {
    eventType: "policy_activated",
    policyId,
    title: "Governance policy activated",
    description: policyId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
  await appendGovernancePlatformTimelineEvent(admin, {
    eventType: "governance_policy_activated",
    title: "Governance policy activated",
    summary: policyId,
  })

  const policy = await getGovernancePolicy(admin, policyId)
  if (!policy) throw new Error("policy_not_found")
  return policy
}

export async function pauseGovernancePolicy(
  admin: SupabaseClient,
  policyId: string,
  input: { actorUserId: string; actorEmail: string },
): Promise<GrowthGovernancePolicy> {
  const now = new Date().toISOString()
  const { error } = await policiesTable(admin)
    .update({ status: "paused", paused_at: now, updated_by: input.actorUserId, updated_at: now })
    .eq("id", policyId)
  if (error) throw new Error(error.message)

  await appendGovernancePolicyEvent(admin, {
    eventType: "policy_paused",
    policyId,
    title: "Governance policy paused",
    description: policyId,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })
  await appendGovernancePlatformTimelineEvent(admin, {
    eventType: "governance_policy_paused",
    title: "Governance policy paused",
    summary: policyId,
  })

  const policy = await getGovernancePolicy(admin, policyId)
  if (!policy) throw new Error("policy_not_found")
  return policy
}

export async function listGovernanceRetentionPolicies(admin: SupabaseClient): Promise<GrowthGovernanceRetentionPolicy[]> {
  const { data, error } = await retentionTable(admin).select("*").order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)
  return ((data ?? []) as Record<string, unknown>[]).map(mapRetention)
}

export async function upsertGovernanceRetentionPolicy(
  admin: SupabaseClient,
  input: {
    id?: string
    scope: GrowthGovernanceRetentionPolicy["scope"]
    retentionDays: number
    legalHold?: boolean
    description?: string
    actorUserId: string
    actorEmail: string
  },
): Promise<GrowthGovernanceRetentionPolicy> {
  const now = new Date().toISOString()
  const payload = {
    scope: input.scope,
    retention_days: input.retentionDays,
    legal_hold: Boolean(input.legalHold),
    description: input.description?.trim() ?? "",
    status: "active",
    updated_by: input.actorUserId,
    updated_at: now,
  }

  if (input.id) {
    const { error } = await retentionTable(admin).update(payload).eq("id", input.id)
    if (error) throw new Error(error.message)
    const { data } = await retentionTable(admin).select("*").eq("id", input.id).single()
    if (!data) throw new Error("retention_not_found")
    if (input.legalHold) {
      await appendGovernancePolicyEvent(admin, {
        eventType: "legal_hold_applied",
        severity: "high",
        title: "Legal hold applied",
        description: input.scope,
        actorUserId: input.actorUserId,
        actorEmail: input.actorEmail,
      })
    }
    return mapRetention(data as Record<string, unknown>)
  }

  const { data, error } = await retentionTable(admin)
    .insert({ ...payload, created_by: input.actorUserId })
    .select("*")
    .single()
  if (error) throw new Error(error.message)

  await appendGovernancePolicyEvent(admin, {
    eventType: "retention_updated",
    title: "Retention policy updated",
    description: input.scope,
    actorUserId: input.actorUserId,
    actorEmail: input.actorEmail,
  })

  return mapRetention(data as Record<string, unknown>)
}

export async function fetchGrowthEnterpriseGovernanceDashboard(
  admin: SupabaseClient,
): Promise<GrowthEnterpriseGovernanceDashboard> {
  const [policies, activePolicies, recentAudit, recentExports, recentViolations, retention, auditCount, exportCount, violationCount] =
    await Promise.all([
      listGovernancePolicies(admin),
      listActiveGovernancePolicies(admin),
      listGovernanceApprovalAudit(admin, { limit: 20 }),
      listGovernanceExports(admin, { limit: 20 }),
      listGovernancePolicyEvents(admin, { eventType: "policy_violation", limit: 20 }),
      listGovernanceRetentionPolicies(admin),
      admin.schema("growth").from("governance_approval_audit").select("id", { count: "exact", head: true }),
      Promise.all([
        admin.schema("growth").from("governance_activity_exports").select("id", { count: "exact", head: true }),
        admin.schema("growth").from("governance_compliance_exports").select("id", { count: "exact", head: true }),
      ]),
      admin.schema("growth").from("governance_policy_events").select("id", { count: "exact", head: true }).eq("event_type", "policy_violation"),
    ])

  const legalHoldCount = retention.filter((policy) => policy.legalHold && policy.status === "active").length

  return {
    qa_marker: GROWTH_ENTERPRISE_GOVERNANCE_QA_MARKER,
    activePolicies: activePolicies.length,
    approvalEvents: auditCount.count ?? 0,
    exportsGenerated: (exportCount[0].count ?? 0) + (exportCount[1].count ?? 0),
    retentionPolicies: retention.filter((policy) => policy.status === "active").length,
    policyViolations: violationCount.count ?? 0,
    legalHoldCount,
    policies,
    recentAudit,
    recentExports,
    recentViolations,
    retention,
  }
}

export async function previewGovernancePolicyEffects(
  admin: SupabaseClient,
  input: {
    action: import("@/lib/growth/governance/governance-types").GrowthGovernanceAction
    actorEmail: string
    recipientEmail?: string
    providerFamily?: string
    dailySendCount?: number
  },
) {
  const { evaluateGovernancePolicies } = await import("@/lib/growth/governance/policy-engine")
  const policies = await listActiveGovernancePolicies(admin)
  return evaluateGovernancePolicies(policies, {
    action: input.action,
    actorUserId: "preview",
    actorEmail: input.actorEmail,
    sourceRoute: "governance_preview",
    recipientEmail: input.recipientEmail,
    providerFamily: input.providerFamily,
    dailySendCount: input.dailySendCount,
    humanApprovalConfirmed: true,
  })
}
