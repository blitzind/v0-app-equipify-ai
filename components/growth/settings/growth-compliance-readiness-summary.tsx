"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import type { GrowthComplianceDashboard, GrowthSenderReputationTier } from "@/lib/growth/compliance/compliance-types"
import { senderReputationTierLabel } from "@/lib/growth/compliance/sender-reputation"
import type { VoiceComplianceReadinessSnapshot } from "@/lib/voice/compliance-orchestration/types"

function resolveWorkspaceStatus(tier: GrowthSenderReputationTier): string {
  if (tier === "healthy") return "Compliant"
  if (tier === "monitor") return "Monitoring"
  return "Needs attention"
}

export function GrowthComplianceReadinessSummary() {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<GrowthComplianceDashboard | null>(null)
  const [voiceReadiness, setVoiceReadiness] = useState<VoiceComplianceReadinessSnapshot | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dashboardRes, voiceRes] = await Promise.all([
        fetch("/api/platform/growth/compliance/dashboard", { cache: "no-store" }),
        fetch("/api/platform/growth/voice/compliance/readiness", { cache: "no-store" }),
      ])

      const dashboardData = (await dashboardRes.json().catch(() => ({}))) as {
        ok?: boolean
        dashboard?: GrowthComplianceDashboard
      }
      const voiceData = (await voiceRes.json().catch(() => ({}))) as {
        readiness?: VoiceComplianceReadinessSnapshot
      }

      if (dashboardData.dashboard) setDashboard(dashboardData.dashboard)
      if (voiceData.readiness) setVoiceReadiness(voiceData.readiness)
    } catch {
      // Tiles fall back to Unknown
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const emailTier = dashboard?.senderReputation.tier
  const consentLabel = voiceReadiness?.consentReadiness ? "Enabled" : "Monitoring"

  return (
    <div data-growth-settings-compliance-refinement={GROWTH_SETTINGS_COMPLIANCE_REFINEMENT_2G_QA_MARKER}>
      <GrowthSettingsCard title="Compliance readiness">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            Loading compliance status…
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Workspace"
              value={emailTier ? resolveWorkspaceStatus(emailTier) : "Unknown"}
            />
            <StatTile label="Monitoring" value={dashboard ? "Active" : "Unknown"} />
            <StatTile label="Consent tracking" value={consentLabel} />
            <StatTile
              label="Email compliance"
              value={emailTier ? senderReputationTierLabel(emailTier) : "Unknown"}
            />
          </div>
        )}
      </GrowthSettingsCard>
    </div>
  )
}
