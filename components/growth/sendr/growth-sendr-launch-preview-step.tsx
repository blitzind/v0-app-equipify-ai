"use client"

import { Loader2 } from "lucide-react"
import type { GrowthSendrLaunchPreviewResult } from "@/lib/growth/sendr/growth-sendr-types"

type Props = {
  preview: GrowthSendrLaunchPreviewResult | null
  loading: boolean
  error: string | null
}

function CountRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}

export function GrowthSendrLaunchPreviewStep({ preview, loading, error }: Props) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Computing enrollment preview…
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  if (!preview) {
    return (
      <p className="text-sm text-muted-foreground">
        Continue to load member counts, SENDR URL, and sample variables.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">Preview personalization & eligibility</h3>
        <p className="text-sm text-muted-foreground">Read-only — no enrollment writes yet.</p>
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <CountRow label="Total members" value={preview.memberCount} />
        <CountRow label="Eligible" value={preview.eligibleCount} />
        <CountRow label="Already enrolled" value={preview.alreadyEnrolledCount} />
        <CountRow label="Missing lead" value={preview.missingLeadCount} />
        <CountRow label="Suppressed" value={preview.suppressedCount} />
        <CountRow label="Blocked by limits" value={preview.blockedCount} />
      </div>

      {preview.sendrPageUrl ? (
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase text-muted-foreground">SENDR page URL</p>
          <p className="break-all text-sm">{preview.sendrPageUrl}</p>
        </div>
      ) : null}

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase text-muted-foreground">Sample variables</p>
        <div className="rounded-md bg-muted/50 p-3 text-sm">
          {Object.entries(preview.sampleVariables).map(([key, value]) => (
            <div key={key} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{key}</span>
              <span className="truncate font-mono text-xs">{value || "—"}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Est. reads {preview.estimatedReads} · writes {preview.estimatedWrites}
      </p>
    </div>
  )
}
