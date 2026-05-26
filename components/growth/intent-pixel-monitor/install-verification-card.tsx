"use client"

import { ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { GrowthIntentPixelInstallVerification } from "@/lib/growth/intent-pixel/live-visitor-monitor-types"
import { PixelHealthCheckRow, PixelHealthIndicator } from "@/components/growth/intent-pixel-monitor/pixel-health-indicator"

export function InstallVerificationCard({
  verification,
}: {
  verification: GrowthIntentPixelInstallVerification | null
}) {
  if (!verification) {
    return (
      <section className="rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Install verification</h2>
          <p className="text-sm text-muted-foreground">Loading pixel health checks…</p>
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" />
          <div>
            <h2 className="text-lg font-semibold">Install verification</h2>
            <p className="text-sm text-muted-foreground">
              Pixel script, traffic, domains, schema, and consent — no outbound calls.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">Pixel status</Badge>
          <PixelHealthIndicator tone={verification.health_tone} label={verification.status_label} />
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        <ul className="space-y-2">
          {verification.checks.map((check) => (
            <PixelHealthCheckRow
              key={check.id}
              label={check.label}
              passed={check.passed}
              tone={check.tone}
              detail={check.detail}
            />
          ))}
        </ul>
        <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
          <dl className="mt-3 space-y-2">
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Events (15m)</dt>
              <dd className="font-mono tabular-nums">{verification.recent_event_count_15m}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Domain mismatches (1h)</dt>
              <dd className="font-mono tabular-nums">{verification.domain_mismatch_count_1h}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Tracking</dt>
              <dd>{verification.tracking_enabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted-foreground">Consent (24h sessions)</dt>
              <dd className="text-right text-xs">
                Granted {verification.consent_distribution.granted} · Denied{" "}
                {verification.consent_distribution.denied} · Unknown{" "}
                {verification.consent_distribution.unknown}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
