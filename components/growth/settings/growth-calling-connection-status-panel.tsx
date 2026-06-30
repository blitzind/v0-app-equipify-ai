"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ExternalLink, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_SETTINGS_INNER_GAP,
  GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER,
  GrowthSettingsBadge,
  GrowthSettingsCard,
} from "@/components/growth/growth-settings-ui"
import {
  NATIVE_DIALER_PROVIDER_LABELS,
  type NativeDialerProviderId,
} from "@/lib/growth/native-dialer/native-dialer-types"
import type {
  VoiceBrowserCallingReadinessSnapshot,
  VoiceOperatorPresencePublicView,
} from "@/lib/voice/browser-calling/types"

const PLATFORM_ADMIN_VOICE_HREF = "/admin/growth/settings/communications"

type VoiceNumberRow = {
  phoneNumber?: string
  friendlyName?: string | null
  status?: string
}

function formatLastSync(value: string | null | undefined): string {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString()
}

function providerLabel(providerId: NativeDialerProviderId | null | undefined): string {
  if (!providerId || providerId === "stub") return "Not configured"
  return NATIVE_DIALER_PROVIDER_LABELS[providerId] ?? "Configured"
}

function connectionTone(ready: boolean): "healthy" | "attention" | "neutral" {
  return ready ? "healthy" : "attention"
}

export function GrowthCallingConnectionStatusPanel() {
  const [loading, setLoading] = useState(true)
  const [readiness, setReadiness] = useState<VoiceBrowserCallingReadinessSnapshot | null>(null)
  const [operators, setOperators] = useState<VoiceOperatorPresencePublicView[]>([])
  const [primaryProvider, setPrimaryProvider] = useState<NativeDialerProviderId | null>(null)
  const [numbers, setNumbers] = useState<VoiceNumberRow[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [presenceRes, dialerRes, numbersRes] = await Promise.all([
        fetch("/api/platform/growth/voice/browser/presence", { cache: "no-store" }),
        fetch("/api/platform/growth/calls/settings", { cache: "no-store" }),
        fetch("/api/platform/growth/voice/numbers", { cache: "no-store" }),
      ])

      const presenceData = (await presenceRes.json().catch(() => ({}))) as {
        readiness?: VoiceBrowserCallingReadinessSnapshot
        operators?: VoiceOperatorPresencePublicView[]
      }
      const dialerData = (await dialerRes.json().catch(() => ({}))) as {
        settings?: { primaryProvider?: NativeDialerProviderId }
      }
      const numbersData = (await numbersRes.json().catch(() => ({}))) as {
        numbers?: VoiceNumberRow[]
      }

      setReadiness(presenceData.readiness ?? null)
      setOperators(presenceData.operators ?? [])
      setPrimaryProvider(dialerData.settings?.primaryProvider ?? null)
      setNumbers(numbersData.numbers ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const connectedNumber = useMemo(() => {
    const active = numbers.find((row) => row.status === "active" || row.status === "in-use")
    return active?.phoneNumber ?? numbers[0]?.phoneNumber ?? "—"
  }, [numbers])

  const lastSync = useMemo(() => {
    const timestamps = operators.map((row) => row.lastSeenAt).filter(Boolean)
    if (timestamps.length === 0) return "—"
    return formatLastSync(timestamps.sort().at(-1) ?? null)
  }, [operators])

  const callingReady = Boolean(readiness?.browserCallingReady)

  return (
    <div data-growth-settings-voice-calling-refinement={GROWTH_SETTINGS_VOICE_CALLING_REFINEMENT_2D_QA_MARKER}>
    <GrowthSettingsCard
      title="Connection status"
      headerAside={
        <GrowthSettingsBadge
          label={callingReady ? "Connected" : "Setup required"}
          tone={connectionTone(callingReady)}
        />
      }
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading connection status…
        </p>
      ) : (
        <div className={GROWTH_SETTINGS_INNER_GAP}>
          {!callingReady ? (
            <div className="rounded-xl border border-dashed border-border px-4 py-4">
              <p className="text-sm font-medium">Calling is not ready yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your workspace needs a phone provider and number before you can place browser calls.
              </p>
              <Button type="button" size="sm" className="mt-3" asChild>
                <Link href={PLATFORM_ADMIN_VOICE_HREF}>
                  Open Platform admin
                  <ExternalLink className="ml-1.5 size-3.5" aria-hidden />
                </Link>
              </Button>
            </div>
          ) : null}

          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Provider</dt>
              <dd className="mt-0.5 text-sm font-medium">{providerLabel(primaryProvider)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Connected number</dt>
              <dd className="mt-0.5 text-sm font-medium">{connectedNumber}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Calling ready</dt>
              <dd className="mt-0.5 text-sm font-medium">{callingReady ? "Yes" : "No"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Last sync</dt>
              <dd className="mt-0.5 text-sm font-medium">{lastSync}</dd>
            </div>
          </dl>

          <p className="text-xs text-muted-foreground">
            Phone numbers, credentials, and routing are managed by Platform admin.
          </p>
        </div>
      )}
    </GrowthSettingsCard>
    </div>
  )
}
