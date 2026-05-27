import type {
  GrowthSenderFatigueType,
  GrowthSenderPoolMemberContext,
} from "@/lib/growth/sender-pools/sender-pool-types"

export type SenderFatigueSignalInput = {
  recentVolume?: number
  previousReplyRate?: number
  currentReplyRate?: number
  bounceRate?: number
  complaintRate?: number
  previousOpenClickRate?: number
  currentOpenClickRate?: number
  warmupProgress?: number
  warmupEnabled?: boolean
  providerHealthScore?: number
  previousProviderHealthScore?: number
}

export type SenderFatigueDetection = {
  fatigueType: GrowthSenderFatigueType
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string
}

export function detectSenderFatigueSignals(input: SenderFatigueSignalInput): SenderFatigueDetection[] {
  const events: SenderFatigueDetection[] = []
  const volume = input.recentVolume ?? 0
  const bounceRate = input.bounceRate ?? 0
  const complaintRate = input.complaintRate ?? 0
  const prevReply = input.previousReplyRate ?? 0
  const curReply = input.currentReplyRate ?? 0
  const prevOc = input.previousOpenClickRate ?? 0
  const curOc = input.currentOpenClickRate ?? 0
  const warmupProgress = input.warmupProgress ?? 0
  const providerHealth = input.providerHealthScore ?? 100
  const prevProviderHealth = input.previousProviderHealthScore ?? providerHealth

  if (volume >= 400) {
    events.push({
      fatigueType: "high_recent_volume",
      severity: volume >= 800 ? "high" : "medium",
      title: "High recent volume",
      description: `Sender sent ${volume} messages recently — consider cooldown.`,
    })
  }

  if (prevReply > 0 && curReply < prevReply * 0.4) {
    events.push({
      fatigueType: "reply_collapse",
      severity: "high",
      title: "Reply rate collapsed",
      description: "Reply rate dropped sharply versus prior window.",
    })
  }

  if (bounceRate >= 5) {
    events.push({
      fatigueType: "bounce_spike",
      severity: bounceRate >= 10 ? "critical" : "high",
      title: "Bounce spike",
      description: `Bounce rate at ${bounceRate.toFixed(1)}%.`,
    })
  }

  if (complaintRate >= 0.3) {
    events.push({
      fatigueType: "complaint_spike",
      severity: complaintRate >= 1 ? "critical" : "high",
      title: "Complaint spike",
      description: `Complaint rate at ${complaintRate.toFixed(2)}%.`,
    })
  }

  if (prevOc > 0 && curOc < prevOc * 0.35) {
    events.push({
      fatigueType: "open_click_collapse",
      severity: "medium",
      title: "Open/click collapse",
      description: "Engagement dropped versus prior window.",
    })
  }

  if (input.warmupEnabled && volume > 50 && warmupProgress < 30) {
    events.push({
      fatigueType: "warmup_mismatch",
      severity: "high",
      title: "Warmup mismatch",
      description: "Volume exceeds warmup stage allowance.",
    })
  }

  if (providerHealth < 50 && providerHealth < prevProviderHealth - 15) {
    events.push({
      fatigueType: "provider_degradation",
      severity: providerHealth < 30 ? "critical" : "high",
      title: "Provider degradation",
      description: "Provider health declined — route may be unstable.",
    })
  }

  return events
}

export function memberContextFromFatigue(member: GrowthSenderPoolMemberContext): SenderFatigueSignalInput {
  return {
    recentVolume: member.recentVolume,
    bounceRate: member.bounceRisk,
    complaintRate: member.complaintRisk,
    warmupProgress: member.warmupProgress,
    providerHealthScore: member.providerHealthScore,
    currentReplyRate: Math.max(0, 100 - member.bounceRisk),
    previousReplyRate: Math.max(0, 100 - member.bounceRisk - 10),
    currentOpenClickRate: Math.max(0, member.healthScore),
    previousOpenClickRate: Math.max(0, member.healthScore + 5),
    warmupEnabled: member.warmupProgress > 0,
  }
}

export function fatigueSeverityRank(severity: SenderFatigueDetection["severity"]): number {
  switch (severity) {
    case "critical":
      return 4
    case "high":
      return 3
    case "medium":
      return 2
    default:
      return 1
  }
}
