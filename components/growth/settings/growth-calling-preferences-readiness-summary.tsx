"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { StatTile } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  NATIVE_DIALER_PROVIDER_LABELS,
  type NativeDialerProviderId,
} from "@/lib/growth/native-dialer/native-dialer-types"
import type { GrowthLiveCoachingSettings } from "@/lib/growth/realtime/providers/provider-types"
import type { OperatorAssistPreferencesPublicView } from "@/lib/growth/operator-assist/types"
import { GROWTH_AVA_CALL_ASSISTANCE_TITLE } from "@/lib/growth/workspace/growth-workspace-ava-identity"
import type { VoiceBrowserCallingReadinessSnapshot } from "@/lib/voice/browser-calling/types"

type ReadinessSnapshot = {
  callingReady: boolean
  providerLabel: string
  aiAssistLabel: string
  liveCoachingLabel: string
}

function operatorAssistEnabled(preferences: OperatorAssistPreferencesPublicView | null): boolean {
  if (!preferences) return false
  if (preferences.quietMode) return false
  return Object.values(preferences.enabledCategories).some(Boolean)
}

function liveCoachingEnabled(settings: GrowthLiveCoachingSettings | null): boolean {
  if (!settings) return false
  return (
    Boolean(settings.activeProviderConnectionId) ||
    settings.speakerSeparationEnabled ||
    settings.keywordEventsEnabled
  )
}

function providerDisplayLabel(providerId: NativeDialerProviderId | null | undefined): string {
  if (!providerId || providerId === "stub") return "Setup required"
  return NATIVE_DIALER_PROVIDER_LABELS[providerId] ?? "Configured"
}

export function GrowthCallingPreferencesReadinessSummary() {
  const [loading, setLoading] = useState(true)
  const [snapshot, setSnapshot] = useState<ReadinessSnapshot | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [presenceRes, dialerRes, coachingRes, assistRes] = await Promise.all([
        fetch("/api/platform/growth/voice/browser/presence", { cache: "no-store" }),
        fetch("/api/platform/growth/calls/settings", { cache: "no-store" }),
        fetch("/api/platform/growth/live-coaching/settings", { cache: "no-store" }),
        fetch("/api/platform/growth/operator-assist/preferences", { cache: "no-store" }),
      ])

      const presenceData = (await presenceRes.json().catch(() => ({}))) as {
        readiness?: VoiceBrowserCallingReadinessSnapshot
      }
      const dialerData = (await dialerRes.json().catch(() => ({}))) as {
        settings?: { primaryProvider?: NativeDialerProviderId }
      }
      const coachingData = (await coachingRes.json().catch(() => ({}))) as {
        settings?: GrowthLiveCoachingSettings
      }
      const assistData = (await assistRes.json().catch(() => ({}))) as {
        preferences?: OperatorAssistPreferencesPublicView
      }

      const readiness = presenceData.readiness
      const callingReady = Boolean(readiness?.browserCallingReady)
      const assistOn = operatorAssistEnabled(assistData.preferences ?? null)
      const coachingOn = liveCoachingEnabled(coachingData.settings ?? null)

      setSnapshot({
        callingReady,
        providerLabel: providerDisplayLabel(dialerData.settings?.primaryProvider),
        aiAssistLabel: assistOn ? "Enabled" : "Disabled",
        liveCoachingLabel: coachingOn ? "Enabled" : "Disabled",
      })
    } catch {
      setSnapshot({
        callingReady: false,
        providerLabel: "Unknown",
        aiAssistLabel: "Unknown",
        liveCoachingLabel: "Unknown",
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div data-growth-settings-voice-calling-refinement={GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER}>
    <GrowthSettingsCard title="Calling readiness">
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading calling status…
        </p>
      ) : snapshot ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile label="Calling ready" value={snapshot.callingReady ? "Ready" : "Not ready"} />
          <StatTile label="Provider" value={snapshot.providerLabel} />
          <StatTile label={GROWTH_AVA_CALL_ASSISTANCE_TITLE} value={snapshot.aiAssistLabel} />
          <StatTile label="Live coaching" value={snapshot.liveCoachingLabel} />
        </div>
      ) : null}
    </GrowthSettingsCard>
    </div>
  )
}
