import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildDefaultGrowthAutonomyApprovalPolicies,
  buildDefaultGrowthAutonomyCapabilityToggles,
  buildDefaultGrowthAutonomySettings,
  GROWTH_AUTONOMY_DEFAULT_DAILY_BUDGET_LIMITS,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import {
  buildDefaultGrowthAutonomyChannelPermissions,
  buildDefaultGrowthAutonomyOutboundControls,
  normalizeGrowthAutonomyChannelPrepareConfig,
  normalizeGrowthAutonomyOutboundControls,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  GROWTH_AUTONOMY_APPROVAL_POLICIES,
  GROWTH_AUTONOMY_BUDGET_KEYS,
  GROWTH_AUTONOMY_CAPABILITIES,
  GROWTH_AUTONOMY_MASTER_MODES,
  GROWTH_AUTONOMY_QA_MARKER,
  type GrowthAutonomyApprovalPolicies,
  type GrowthAutonomyApprovalPolicy,
  type GrowthAutonomyBudgetKey,
  type GrowthAutonomyCapability,
  type GrowthAutonomyCapabilityToggles,
  type GrowthAutonomyChannelPermissions,
  type GrowthAutonomyDailyBudgetLimits,
  type GrowthAutonomyMasterMode,
  type GrowthAutonomyOutboundControls,
  type GrowthAutonomySettings,
} from "@/lib/growth/autonomy/growth-autonomy-types"
import { probeRuntimeTable } from "@/lib/growth/runtime-guardrails/growth-runtime-schema-probe"

function settingsTable(admin: SupabaseClient) {
  return admin.schema("growth").from("organization_autonomy_settings")
}

function isMasterMode(value: unknown): value is GrowthAutonomyMasterMode {
  return typeof value === "string" && (GROWTH_AUTONOMY_MASTER_MODES as readonly string[]).includes(value)
}

function isApprovalPolicy(value: unknown): value is GrowthAutonomyApprovalPolicy {
  return typeof value === "string" && (GROWTH_AUTONOMY_APPROVAL_POLICIES as readonly string[]).includes(value)
}

function normalizeCapabilityToggles(raw: unknown): GrowthAutonomyCapabilityToggles {
  const defaults = buildDefaultGrowthAutonomyCapabilityToggles()
  if (!raw || typeof raw !== "object") return defaults
  const input = raw as Record<string, unknown>
  const result = { ...defaults }
  for (const capability of GROWTH_AUTONOMY_CAPABILITIES) {
    if (typeof input[capability] === "boolean") {
      result[capability] = input[capability]
    }
  }
  return result
}

function normalizeApprovalPolicies(raw: unknown): GrowthAutonomyApprovalPolicies {
  const defaults = buildDefaultGrowthAutonomyApprovalPolicies()
  if (!raw || typeof raw !== "object") return defaults
  const input = raw as Record<string, unknown>
  const result = { ...defaults }
  for (const capability of GROWTH_AUTONOMY_CAPABILITIES) {
    if (isApprovalPolicy(input[capability])) {
      result[capability] = input[capability]
    }
  }
  return result
}

function normalizeChannelPermissions(raw: unknown): GrowthAutonomyChannelPermissions {
  const defaults = buildDefaultGrowthAutonomyChannelPermissions()
  if (!raw || typeof raw !== "object") return defaults
  const input = raw as Record<string, unknown>
  const result = { ...defaults }
  for (const channel of ["email", "sms", "voice"] as const) {
    result[channel] = normalizeGrowthAutonomyChannelPrepareConfig(input[channel])
  }
  return result
}

function readOutboundControlsFromChannelPermissions(raw: unknown): GrowthAutonomyOutboundControls {
  if (!raw || typeof raw !== "object") return buildDefaultGrowthAutonomyOutboundControls()
  const input = raw as Record<string, unknown>
  return normalizeGrowthAutonomyOutboundControls(input._outbound)
}

function writeOutboundControlsToChannelPermissions(
  permissions: GrowthAutonomyChannelPermissions,
  outboundControls: GrowthAutonomyOutboundControls,
): GrowthAutonomyChannelPermissions & { _outbound: GrowthAutonomyOutboundControls } {
  return {
    ...permissions,
    _outbound: outboundControls,
  }
}

function normalizeDailyBudgetLimits(raw: unknown): GrowthAutonomyDailyBudgetLimits {
  const defaults = { ...GROWTH_AUTONOMY_DEFAULT_DAILY_BUDGET_LIMITS }
  if (!raw || typeof raw !== "object") return defaults
  const input = raw as Record<string, unknown>
  const result = { ...defaults }
  for (const key of GROWTH_AUTONOMY_BUDGET_KEYS) {
    const value = input[key]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      result[key as GrowthAutonomyBudgetKey] = Math.floor(value)
    }
  }
  return result
}

function mapRow(organizationId: string, row: Record<string, unknown>): GrowthAutonomySettings {
  return {
    organizationId,
    masterMode: isMasterMode(row.master_mode) ? row.master_mode : "manual",
    capabilityToggles: normalizeCapabilityToggles(row.capability_toggles),
    approvalPolicies: normalizeApprovalPolicies(row.approval_policies),
    channelPermissions: normalizeChannelPermissions(row.channel_permissions),
    dailyBudgetLimits: normalizeDailyBudgetLimits(row.daily_budget_limits),
    outboundControls: readOutboundControlsFromChannelPermissions(row.channel_permissions),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  }
}

export async function fetchGrowthAutonomySettings(
  admin: SupabaseClient,
  organizationId: string,
): Promise<GrowthAutonomySettings> {
  const defaults = buildDefaultGrowthAutonomySettings(organizationId)
  const probe = await probeRuntimeTable(admin, "organization_autonomy_settings")
  if (probe.missing) return defaults

  const { data, error } = await settingsTable(admin)
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle()

  if (error || !data) return defaults
  return mapRow(organizationId, data as Record<string, unknown>)
}

export async function upsertGrowthAutonomySettings(
  admin: SupabaseClient,
  organizationId: string,
  patch: Partial<
    Pick<
      GrowthAutonomySettings,
      "masterMode" | "capabilityToggles" | "approvalPolicies" | "channelPermissions" | "dailyBudgetLimits" | "outboundControls"
    >
  >,
): Promise<GrowthAutonomySettings> {
  const current = await fetchGrowthAutonomySettings(admin, organizationId)
  const channelPermissions = patch.channelPermissions ?? current.channelPermissions
  const outboundControls = patch.outboundControls ?? current.outboundControls
  const next = {
    organization_id: organizationId,
    master_mode: patch.masterMode ?? current.masterMode,
    capability_toggles: patch.capabilityToggles ?? current.capabilityToggles,
    approval_policies: patch.approvalPolicies ?? current.approvalPolicies,
    channel_permissions: writeOutboundControlsToChannelPermissions(channelPermissions, outboundControls),
    daily_budget_limits: patch.dailyBudgetLimits ?? current.dailyBudgetLimits,
    qa_marker: GROWTH_AUTONOMY_QA_MARKER,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await settingsTable(admin).upsert(next, { onConflict: "organization_id" }).select("*").single()
  if (error) throw new Error(error.message)
  return mapRow(organizationId, data as Record<string, unknown>)
}
