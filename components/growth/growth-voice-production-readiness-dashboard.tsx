"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCopy,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER,
  VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF,
  type VoiceProductionReadinessCenterSnapshot,
  type VoiceProductionReadinessSection,
  type VoiceProductionReadinessStatus,
} from "@/lib/voice/production-readiness/types"

type ReadinessResponse = {
  ok?: boolean
  qaMarker?: string
  center?: VoiceProductionReadinessCenterSnapshot
  message?: string
}

function statusTone(status: VoiceProductionReadinessStatus): "healthy" | "attention" | "critical" {
  if (status === "ready") return "healthy"
  if (status === "partial") return "attention"
  return "critical"
}

function StatusIcon({ status }: { status: VoiceProductionReadinessStatus }) {
  if (status === "ready") return <CheckCircle2 className="size-4 text-emerald-600" aria-hidden />
  if (status === "partial") return <AlertTriangle className="size-4 text-amber-600" aria-hidden />
  return <XCircle className="size-4 text-rose-600" aria-hidden />
}

function IssueList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <p className="text-xs font-medium text-foreground">{label}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-xs text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function ReadinessSectionCard({ section }: { section: VoiceProductionReadinessSection }) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)

  async function copyWebhook(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopiedUrl(url)
      window.setTimeout(() => setCopiedUrl(null), 2000)
    } catch {
      setCopiedUrl("error")
    }
  }

  return (
    <GrowthEngineCard
      title={section.title}
      icon={<StatusIcon status={section.status} />}
      data-voice-readiness-section={section.id}
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <GrowthBadge label={section.statusLabel} tone={statusTone(section.status)} />
          <span className="text-xs text-muted-foreground">{section.summary}</span>
        </div>

        <IssueList label="Missing env vars" items={section.missingEnvVars} />
        <IssueList label="Missing credentials" items={section.missingCredentials} />
        <IssueList label="Missing webhook URLs" items={section.missingWebhookUrls} />
        <IssueList label="Phone number issues" items={section.phoneNumberIssues} />
        <IssueList label="Failing health checks" items={section.failingHealthChecks} />

        {section.lastSuccessfulTest ? (
          <p className="text-xs text-muted-foreground">
            Last successful signal: {new Date(section.lastSuccessfulTest).toLocaleString()}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Last successful test: none recorded yet</p>
        )}

        <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-foreground">
          <span className="font-medium">Recommended fix:</span> {section.recommendedFix}
        </p>

        {section.webhookUrls.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">Webhook URLs</p>
            {section.webhookUrls.map((webhook) => (
              <div
                key={webhook.label}
                className="flex flex-col gap-2 rounded-md border border-border/60 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium">{webhook.label}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">{webhook.url}</p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={() => void copyWebhook(webhook.url)}>
                  <ClipboardCopy className="mr-1 size-3.5" />
                  {copiedUrl === webhook.url ? "Copied" : "Copy URL"}
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {section.settingsHref ? (
            <Button type="button" size="sm" variant="outline" asChild>
              <Link href={section.settingsHref}>
                <ExternalLink className="mr-1 size-3.5" />
                Open provider settings
              </Link>
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href={VOICE_PRODUCTION_READINESS_GLOBAL_SETTINGS_HREF}>View deployment requirements</Link>
          </Button>
        </div>
      </div>
    </GrowthEngineCard>
  )
}

export function GrowthVoiceProductionReadinessDashboard() {
  const [center, setCenter] = useState<VoiceProductionReadinessCenterSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/voice/readiness", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as ReadinessResponse
      if (!res.ok || !data.ok || !data.center) {
        throw new Error(data.message ?? "Could not load voice production readiness center.")
      }
      setCenter(data.center)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading && !center) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Running voice readiness checks…
      </div>
    )
  }

  if (error && !center) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-1 size-3.5" />
          Re-run readiness check
        </Button>
      </div>
    )
  }

  if (!center) return null

  return (
    <div
      className="space-y-6"
      data-voice-production-readiness-center-qa-marker={VOICE_PRODUCTION_READINESS_CENTER_QA_MARKER}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            icon={<ShieldCheck className="size-3.5" />}
            label="Overall"
            value={center.overallStatus === "ready" ? "Ready" : center.overallStatus === "partial" ? "Partial" : "Blocked"}
          />
          <StatTile label="Ready" value={center.summary.readyCount} />
          <StatTile label="Partial" value={center.summary.partialCount} />
          <StatTile label="Blocked" value={center.summary.blockedCount} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Re-run readiness check
          </Button>
          <Button type="button" variant="outline" size="sm" asChild>
            <Link href={center.globalSettingsHref}>Open provider settings</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={center.transcriptProvidersHref}>Transcript providers</Link>
          </Button>
          <Button type="button" variant="ghost" size="sm" asChild>
            <Link href={center.globalSettingsHref}>View deployment requirements</Link>
          </Button>
        </div>
      </div>

      {!center.schemaReady ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium">Voice schema incomplete</p>
          <p className="mt-1 text-xs">{center.schemaMessage}</p>
        </div>
      ) : null}

      {!center.organizationId ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <p className="font-medium">Organization scope not configured</p>
          <p className="mt-1 text-xs">Set GROWTH_ENGINE_AI_ORG_ID to run org-scoped readiness probes.</p>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Deployment guide: <code className="rounded bg-muted px-1 py-0.5">{center.deploymentRequirementsHref}</code>
        {" · "}
        Generated {new Date(center.generatedAt).toLocaleString()}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {center.sections.map((section) => (
          <ReadinessSectionCard key={section.id} section={section} />
        ))}
      </div>
    </div>
  )
}
