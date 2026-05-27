"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldAlert } from "lucide-react"
import { GrowthBadge, GrowthCollapsibleEngineCard, formatRelativeTime } from "@/components/growth/growth-ui-utils"
import type { GrowthLead } from "@/lib/growth/types"
import { GROWTH_DRAWER_CARD_KEYS } from "@/lib/growth/growth-lead-drawer-stream-filters"
import type { GrowthLeadComplianceDetail } from "@/lib/growth/compliance/compliance-types"
import { maskComplianceEmailHash } from "@/lib/growth/compliance/compliance-types"

type GrowthLeadComplianceProps = {
  lead: GrowthLead
}

export function GrowthLeadCompliance({ lead }: GrowthLeadComplianceProps) {
  const [detail, setDetail] = useState<GrowthLeadComplianceDetail | null>(null)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    if (loaded) return
    try {
      const res = await fetch(`/api/platform/growth/compliance/dashboard?lead_id=${encodeURIComponent(lead.id)}`, {
        cache: "no-store",
      })
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; detail?: GrowthLeadComplianceDetail }
      if (res.ok && data.ok && data.detail) setDetail(data.detail)
    } finally {
      setLoaded(true)
    }
  }, [lead.id, loaded])

  useEffect(() => {
    void load()
  }, [load])

  const activeSuppressions = detail?.suppressions.length ?? 0

  return (
    <GrowthCollapsibleEngineCard
      title="Compliance"
      icon={<ShieldAlert className="size-4" />}
      headerAside={
        activeSuppressions > 0 ? (
          <GrowthBadge label={`${activeSuppressions} suppressed`} tone="warning" />
        ) : (
          <GrowthBadge label="Clear" tone="healthy" />
        )
      }
      defaultOpen={false}
      persistKey={GROWTH_DRAWER_CARD_KEYS.compliance}
    >
      {!detail ? (
        <p className="text-xs text-muted-foreground">No compliance history recorded yet.</p>
      ) : (
        <div className="space-y-4 text-sm">
          {detail.bounces.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Bounce history</p>
              <ul className="space-y-1 text-muted-foreground">
                {detail.bounces.slice(0, 5).map((bounce) => (
                  <li key={bounce.id}>
                    {bounce.bounceType} · {formatRelativeTime(bounce.occurredAt)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.unsubscribes.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Unsubscribe history</p>
              <ul className="space-y-1 text-muted-foreground">
                {detail.unsubscribes.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    {row.scope} · {formatRelativeTime(row.occurredAt)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.complaints.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Complaint history</p>
              <ul className="space-y-1 text-muted-foreground">
                {detail.complaints.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    {row.complaintType} · {formatRelativeTime(row.occurredAt)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.suppressions.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Active suppressions</p>
              <ul className="space-y-1 text-muted-foreground">
                {detail.suppressions.slice(0, 5).map((row) => (
                  <li key={row.id}>
                    {maskComplianceEmailHash(row.emailHash)} · {row.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {detail.timeline.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Compliance timeline</p>
              <ul className="space-y-2">
                {detail.timeline.slice(0, 6).map((item) => (
                  <li key={item.id} className="rounded-lg border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{item.title}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(item.occurredAt)}</span>
                    </div>
                    {item.summary ? <p className="text-muted-foreground">{item.summary}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </GrowthCollapsibleEngineCard>
  )
}
