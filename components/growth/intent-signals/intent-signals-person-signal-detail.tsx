"use client"

import { ExternalLink } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  formatIdentityConfidenceBadge,
  readPersonSignalMetadata,
} from "@/lib/growth/signals/person-signal-metadata"
import type { GrowthSignalDetailRow } from "@/lib/growth/signals/signal-types"

export function IntentSignalsPersonSignalDetail({ signal }: { signal: GrowthSignalDetailRow }) {
  const personMeta = readPersonSignalMetadata(signal)
  const sourceUrl = signal.sources?.[0]?.source_url ?? personMeta.evidence_urls?.[0] ?? null
  const lowConfidence = (personMeta.identity_confidence ?? 1) < 0.75

  return (
    <div className="space-y-4 text-sm" data-person-signal-detail="v1">
      {personMeta.required_review || lowConfidence ? (
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-950">
          Human review required
        </Badge>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Transition type</p>
          <p>{personMeta.transition_type ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Identity confidence</p>
          <p>
            {formatIdentityConfidenceBadge(personMeta.identity_confidence)}
            {personMeta.identity_confidence != null ? ` (${personMeta.identity_confidence})` : ""}
          </p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs uppercase text-muted-foreground">Confidence reason</p>
          <p>{personMeta.identity_confidence_reason ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border/70 p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Previous</p>
        <p className="mt-1">{personMeta.previous_title ?? signal.previous_title ?? "—"}</p>
        <p className="text-muted-foreground">
          {personMeta.previous_company_name ?? "—"}
          {personMeta.previous_company_domain ? ` · ${personMeta.previous_company_domain}` : ""}
        </p>
      </div>

      <div className="rounded-lg border border-border/70 p-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">New</p>
        <p className="mt-1">{personMeta.new_title ?? signal.title ?? "—"}</p>
        <p className="text-muted-foreground">
          {personMeta.new_company_name ?? signal.company_name ?? "—"}
          {personMeta.new_company_domain ?? signal.domain ? ` · ${personMeta.new_company_domain ?? signal.domain}` : ""}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase text-muted-foreground">Evidence summary</p>
        <p>{signal.evidence_summary || "—"}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-xs uppercase text-muted-foreground">Occurred</p>
          <p>{new Date(signal.occurred_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Detected</p>
          <p>{new Date(signal.detected_at).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Signal score</p>
          <p>
            {signal.signal_score} · {signal.urgency}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground">Provider</p>
          <p>{signal.provider_key}</p>
        </div>
      </div>

      {sourceUrl ? (
        <Button type="button" size="sm" variant="outline" asChild>
          <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 size-3.5" />
            View source evidence
          </a>
        </Button>
      ) : null}

      {lowConfidence ? (
        <p className="text-xs text-amber-900">
          Routing actions remain disabled for low-confidence person signals.
        </p>
      ) : null}

      {signal.events?.length ? (
        <div>
          <p className="text-xs uppercase text-muted-foreground">Event timeline</p>
          <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
            {signal.events.slice(0, 8).map((event) => (
              <li key={event.id}>
                {event.event_type} · {new Date(event.occurred_at).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
