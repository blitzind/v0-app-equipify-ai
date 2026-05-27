import type {
  GrowthGovernancePolicyViolation,
  GrowthGovernanceRuleType,
} from "@/lib/growth/governance/governance-types"

function parseHourMinute(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  return hours * 60 + minutes
}

export function evaluateMaxDailySends(
  dailySendCount: number,
  config: Record<string, unknown>,
): GrowthGovernancePolicyViolation | null {
  const max = Number(config.max ?? config.limit ?? 0)
  if (!Number.isFinite(max) || max <= 0) return null
  if (dailySendCount >= max) {
    return {
      ruleType: "max_daily_sends",
      policyId: "",
      policyName: "",
      message: `Daily send limit reached (${dailySendCount}/${max}).`,
      severity: "high",
    }
  }
  return null
}

export function evaluateAllowedSendWindows(config: Record<string, unknown>): GrowthGovernancePolicyViolation | null {
  const start = typeof config.start === "string" ? config.start : "09:00"
  const end = typeof config.end === "string" ? config.end : "17:00"
  const timezone = typeof config.timezone === "string" ? config.timezone : "UTC"
  const startMinutes = parseHourMinute(start)
  const endMinutes = parseHourMinute(end)
  if (startMinutes == null || endMinutes == null) return null

  const now = new Date()
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = formatter.formatToParts(now)
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0)
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0)
  const current = hour * 60 + minute
  const inWindow = startMinutes <= endMinutes ? current >= startMinutes && current <= endMinutes : current >= startMinutes || current <= endMinutes
  if (!inWindow) {
    return {
      ruleType: "allowed_send_windows",
      policyId: "",
      policyName: "",
      message: `Send blocked outside allowed window (${start}–${end} ${timezone}).`,
      severity: "medium",
    }
  }
  return null
}

export function evaluateRestrictedDomain(
  domain: string | undefined,
  config: Record<string, unknown>,
  ruleType: Extract<GrowthGovernanceRuleType, "restricted_domains" | "blocked_recipient_domains">,
): GrowthGovernancePolicyViolation | null {
  if (!domain?.trim()) return null
  const domains = Array.isArray(config.domains) ? (config.domains as string[]) : []
  const normalized = domain.trim().toLowerCase()
  const matched = domains.some((entry) => normalized === entry.trim().toLowerCase() || normalized.endsWith(`.${entry.trim().toLowerCase()}`))
  if (!matched) return null
  return {
    ruleType,
    policyId: "",
    policyName: "",
    message: `Domain restricted by governance policy (${normalized}).`,
    severity: ruleType === "blocked_recipient_domains" ? "critical" : "high",
  }
}

export function evaluateRestrictedProvider(
  providerFamily: string | undefined,
  config: Record<string, unknown>,
): GrowthGovernancePolicyViolation | null {
  if (!providerFamily?.trim()) return null
  const providers = Array.isArray(config.providers) ? (config.providers as string[]) : []
  const normalized = providerFamily.trim().toLowerCase()
  if (!providers.some((entry) => entry.trim().toLowerCase() === normalized)) return null
  return {
    ruleType: "restricted_providers",
    policyId: "",
    policyName: "",
    message: `Provider restricted by governance policy (${normalized}).`,
    severity: "high",
  }
}

export function evaluateApprovalRequiredAboveVolume(
  dailySendCount: number,
  humanApprovalConfirmed: boolean | undefined,
  config: Record<string, unknown>,
): GrowthGovernancePolicyViolation | null {
  const threshold = Number(config.threshold ?? config.volume ?? 0)
  if (!Number.isFinite(threshold) || threshold <= 0) return null
  if (dailySendCount >= threshold && !humanApprovalConfirmed) {
    return {
      ruleType: "approval_required_above_volume",
      policyId: "",
      policyName: "",
      message: `Human approval required above volume threshold (${dailySendCount}/${threshold}).`,
      severity: "high",
    }
  }
  return null
}

export function evaluateAiRequiresReview(
  requiresAiReview: boolean | undefined,
  humanApprovalConfirmed: boolean | undefined,
): GrowthGovernancePolicyViolation | null {
  if (requiresAiReview && !humanApprovalConfirmed) {
    return {
      ruleType: "ai_requires_review",
      policyId: "",
      policyName: "",
      message: "AI-generated content requires human review before approval.",
      severity: "high",
    }
  }
  return null
}

export function extractDomainFromEmail(email: string | undefined): string | undefined {
  if (!email?.includes("@")) return undefined
  return email.split("@").pop()?.trim().toLowerCase()
}
