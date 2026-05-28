"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type { VoiceComplianceManualReviewQueueSnapshot } from "@/lib/voice/compliance-orchestration/types"
import { VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER } from "@/lib/voice/compliance-orchestration/types"

export function GrowthComplianceManualReviewPanel() {
  const [queue, setQueue] = useState<VoiceComplianceManualReviewQueueSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/compliance/manual-review", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { queue?: VoiceComplianceManualReviewQueueSnapshot }
      if (res.ok && data.queue) setQueue(data.queue)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function act(
    itemId: string,
    action: "approve" | "reject" | "grant_consent" | "deny_consent",
    phoneNumber: string,
    channel: string,
  ) {
    setActingId(itemId)
    try {
      await fetch(`/api/platform/growth/voice/compliance/manual-review/${itemId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, phoneNumber, channel }),
      })
      await load()
    } finally {
      setActingId(null)
    }
  }

  if (loading) {
    return (
      <section className={GROWTH_SETTINGS_SECTION_GAP}>
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      </section>
    )
  }

  if (!queue) return null

  return (
    <section
      className={GROWTH_SETTINGS_SECTION_GAP}
      data-voice-compliance-manual-review-qa-marker={VOICE_COMPLIANCE_ORCHESTRATION_QA_MARKER}
    >
      <p className="text-sm font-medium">Manual review queue</p>
      <p className="text-xs text-muted-foreground">{queue.message}</p>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Blocked: {queue.blockedCount}</span>
        <span>Manual review: {queue.manualReviewCount}</span>
      </div>
      {queue.items.length === 0 ? (
        <p className="text-xs text-muted-foreground">No items requiring manual review.</p>
      ) : (
        <ul className="space-y-2">
          {queue.items.map((item) => (
            <li key={item.id} className="rounded-md border border-border/60 px-3 py-2 text-sm">
              <p className="font-medium">{item.phoneNumber}</p>
              <p className="text-xs text-muted-foreground">
                {item.channel} · {item.decision} · {item.source}
              </p>
              {item.reasons.length > 0 ? (
                <p className="text-xs text-muted-foreground">Reasons: {item.reasons.join(", ")}</p>
              ) : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actingId === item.id}
                  onClick={() => void act(item.id, "approve", item.phoneNumber, item.channel)}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={actingId === item.id}
                  onClick={() => void act(item.id, "reject", item.phoneNumber, item.channel)}
                >
                  Reject
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={actingId === item.id}
                  onClick={() => void act(item.id, "grant_consent", item.phoneNumber, item.channel)}
                >
                  Grant consent
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={actingId === item.id}
                  onClick={() => void act(item.id, "deny_consent", item.phoneNumber, item.channel)}
                >
                  Deny consent
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
