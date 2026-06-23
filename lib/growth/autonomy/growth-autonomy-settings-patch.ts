/** GE-AUTO-1B — PATCH validation for autonomy settings (client-safe). */

import {
  GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS,
  GROWTH_AUTONOMY_EDITABLE_CAPABILITIES,
  GROWTH_AUTONOMY_LOCKED_OUTBOUND_CAPABILITIES,
  GROWTH_AUTONOMY_MAX_DAILY_BUDGET,
  buildDefaultGrowthAutonomyCapabilityToggles,
} from "@/lib/growth/autonomy/growth-autonomy-config"
import {
  GROWTH_AUTONOMY_CHANNEL_KEYS,
  buildDefaultGrowthAutonomyChannelPermissions,
  normalizeGrowthAutonomyChannelPrepareConfig,
} from "@/lib/growth/autonomy/growth-autonomy-channel-prepare"
import {
  GROWTH_AUTONOMY_APPROVAL_POLICIES,
  GROWTH_AUTONOMY_MASTER_MODES,
  type GrowthAutonomyApprovalPolicy,
  type GrowthAutonomyBudgetKey,
  type GrowthAutonomyCapability,
  type GrowthAutonomyChannelKey,
  type GrowthAutonomyChannelPermissions,
  type GrowthAutonomyDailyBudgetLimits,
  type GrowthAutonomyMasterMode,
} from "@/lib/growth/autonomy/growth-autonomy-types"

export type GrowthAutonomySettingsPatchInput = {
  masterMode?: GrowthAutonomyMasterMode
  capabilityToggles?: Partial<Record<GrowthAutonomyCapability, boolean>>
  channelPermissions?: Partial<
    Record<GrowthAutonomyChannelKey, Partial<GrowthAutonomyChannelPermissions[GrowthAutonomyChannelKey]>>
  >
  dailyBudgetLimits?: Partial<Record<GrowthAutonomyBudgetKey, number>>
  killSwitches?: {
    autonomyEnabled?: boolean
    autonomyGenerationEnabled?: boolean
  }
  emergencyStop?: boolean
}

export type GrowthAutonomySettingsPatchValidation =
  | { ok: true; patch: GrowthAutonomySettingsPatchInput }
  | { ok: false; error: string }

function isMasterMode(value: unknown): value is GrowthAutonomyMasterMode {
  return typeof value === "string" && (GROWTH_AUTONOMY_MASTER_MODES as readonly string[]).includes(value)
}

function isApprovalPolicy(value: unknown): value is GrowthAutonomyApprovalPolicy {
  return typeof value === "string" && (GROWTH_AUTONOMY_APPROVAL_POLICIES as readonly string[]).includes(value)
}

export function validateGrowthAutonomySettingsPatch(body: unknown): GrowthAutonomySettingsPatchValidation {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body must be a JSON object." }
  }

  const input = body as Record<string, unknown>
  const patch: GrowthAutonomySettingsPatchInput = {}

  if (input.masterMode !== undefined) {
    if (!isMasterMode(input.masterMode)) {
      return { ok: false, error: "Invalid master mode." }
    }
    patch.masterMode = input.masterMode
  }

  if (input.capabilityToggles !== undefined) {
    if (typeof input.capabilityToggles !== "object" || !input.capabilityToggles) {
      return { ok: false, error: "Invalid capability toggles." }
    }
    const toggles = input.capabilityToggles as Record<string, unknown>
    patch.capabilityToggles = {}
    for (const [key, value] of Object.entries(toggles)) {
      if (typeof value !== "boolean") continue
      if ((GROWTH_AUTONOMY_LOCKED_OUTBOUND_CAPABILITIES as readonly string[]).includes(key) && value === true) {
        return { ok: false, error: `Outbound capability ${key} is locked until a later phase.` }
      }
      if (!(GROWTH_AUTONOMY_EDITABLE_CAPABILITIES as readonly string[]).includes(key)) {
        return { ok: false, error: `Capability ${key} is not editable.` }
      }
      patch.capabilityToggles[key as GrowthAutonomyCapability] = value
    }
  }

  if (input.approvalPolicies !== undefined) {
    const policies = input.approvalPolicies as Record<string, unknown>
    for (const value of Object.values(policies)) {
      if (isApprovalPolicy(value) && value === "fully_autonomous") {
        return { ok: false, error: "Autonomous approvals are not allowed in GE-AUTO-1B." }
      }
    }
    return { ok: false, error: "Approval policy changes are not supported in GE-AUTO-1B." }
  }

  if (input.channelPermissions !== undefined) {
    if (typeof input.channelPermissions !== "object" || !input.channelPermissions) {
      return { ok: false, error: "Invalid channel permissions." }
    }
    patch.channelPermissions = {}
    for (const channel of GROWTH_AUTONOMY_CHANNEL_KEYS) {
      const entry = (input.channelPermissions as Record<string, unknown>)[channel]
      if (!entry || typeof entry !== "object") continue
      const row = entry as Record<string, unknown>
      patch.channelPermissions[channel] = normalizeGrowthAutonomyChannelPrepareConfig({
        ...buildDefaultGrowthAutonomyChannelPermissions()[channel],
        ...row,
      })
    }
  }

  if (input.dailyBudgetLimits !== undefined) {
    if (typeof input.dailyBudgetLimits !== "object" || !input.dailyBudgetLimits) {
      return { ok: false, error: "Invalid daily budget limits." }
    }
    const limits = input.dailyBudgetLimits as Record<string, unknown>
    patch.dailyBudgetLimits = {}
    for (const [key, value] of Object.entries(limits)) {
      if (key === "autonomous_outbound_actions") {
        return { ok: false, error: "Outbound autonomy budget is locked until a later phase." }
      }
      if (!(GROWTH_AUTONOMY_EDITABLE_BUDGET_KEYS as readonly string[]).includes(key)) {
        return { ok: false, error: `Budget ${key} is not editable.` }
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > GROWTH_AUTONOMY_MAX_DAILY_BUDGET) {
        return { ok: false, error: `Budget ${key} must be between 0 and ${GROWTH_AUTONOMY_MAX_DAILY_BUDGET}.` }
      }
      patch.dailyBudgetLimits[key as GrowthAutonomyBudgetKey] = Math.floor(value)
    }
  }

  if (input.killSwitches !== undefined) {
    if (typeof input.killSwitches !== "object" || !input.killSwitches) {
      return { ok: false, error: "Invalid kill switches." }
    }
    const killSwitches = input.killSwitches as Record<string, unknown>
    if ("autonomyOutboundEnabled" in killSwitches && killSwitches.autonomyOutboundEnabled === true) {
      return { ok: false, error: "autonomy_outbound_enabled is locked until a later phase." }
    }
    if ("autonomyObjectiveModeEnabled" in killSwitches && killSwitches.autonomyObjectiveModeEnabled === true) {
      return { ok: false, error: "autonomy_objective_mode_enabled is locked until a later phase." }
    }
    patch.killSwitches = {}
    if (typeof killSwitches.autonomyEnabled === "boolean") {
      patch.killSwitches.autonomyEnabled = killSwitches.autonomyEnabled
    }
    if (typeof killSwitches.autonomyGenerationEnabled === "boolean") {
      patch.killSwitches.autonomyGenerationEnabled = killSwitches.autonomyGenerationEnabled
    }
  }

  if (input.emergencyStop === true) {
    patch.emergencyStop = true
  }

  const hasChanges =
    patch.masterMode !== undefined ||
    (patch.capabilityToggles && Object.keys(patch.capabilityToggles).length > 0) ||
    (patch.channelPermissions && Object.keys(patch.channelPermissions).length > 0) ||
    (patch.dailyBudgetLimits && Object.keys(patch.dailyBudgetLimits).length > 0) ||
    (patch.killSwitches && Object.keys(patch.killSwitches).length > 0) ||
    patch.emergencyStop === true

  if (!hasChanges) {
    return { ok: false, error: "No valid fields to update." }
  }

  return { ok: true, patch }
}

export function mergeGrowthAutonomyCapabilityToggles(
  current: Partial<Record<GrowthAutonomyCapability, boolean>>,
  patch: Partial<Record<GrowthAutonomyCapability, boolean>> | undefined,
): Partial<Record<GrowthAutonomyCapability, boolean>> {
  const defaults = buildDefaultGrowthAutonomyCapabilityToggles()
  return {
    ...defaults,
    ...current,
    ...patch,
    email_execution: false,
    sms_execution: false,
    voice_execution: false,
  }
}

export function mergeGrowthAutonomyChannelPermissions(
  current: GrowthAutonomyChannelPermissions,
  patch: GrowthAutonomySettingsPatchInput["channelPermissions"],
): GrowthAutonomyChannelPermissions {
  const defaults = buildDefaultGrowthAutonomyChannelPermissions()
  const merged = { ...defaults, ...current }
  if (!patch) return merged
  for (const channel of GROWTH_AUTONOMY_CHANNEL_KEYS) {
    if (patch[channel]) {
      const current = merged[channel]
      const next = patch[channel]
      merged[channel] = normalizeGrowthAutonomyChannelPrepareConfig({
        ...current,
        ...next,
        quiet_hours: {
          ...current.quiet_hours,
          ...(next.quiet_hours ?? {}),
        },
      })
    }
  }
  return merged
}

export function mergeGrowthAutonomyDailyBudgetLimits(
  current: GrowthAutonomyDailyBudgetLimits,
  patch: Partial<Record<GrowthAutonomyBudgetKey, number>> | undefined,
): GrowthAutonomyDailyBudgetLimits {
  return {
    ...current,
    ...patch,
    autonomous_outbound_actions: 0,
  }
}
