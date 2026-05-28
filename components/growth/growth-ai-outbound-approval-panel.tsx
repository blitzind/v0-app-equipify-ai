"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, PhoneOutgoing, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SETTINGS_SECTION_GAP } from "@/components/growth/growth-settings-ui"
import type {
  VoiceAiOutboundApprovalQueueSnapshot,
  VoiceAiOutboundSessionPublicView,
} from "@/lib/voice/ai-outbound/types"
import { VOICE_AI_OUTBOUND_QA_MARKER } from "@/lib/voice/ai-outbound/types"

function sessionStatusTone(status: VoiceAiOutboundSessionPublicView["outboundSessionStatus"]) {
  if (status === "blocked_by_compliance") return "warning" as const
  if (status === "pending_operator_approval") return "neutral" as const
  if (status === "queued") return "healthy" as const
  return "neutral" as const
}

export function GrowthAiOutboundApprovalPanel() {
  const [queue, setQueue] = useState<VoiceAiOutboundApprovalQueueSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/ai-outbound/approval-queue", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { queue?: VoiceAiOutboundApprovalQueueSnapshot }
      if (res.ok && data.queue) setQueue(data.queue)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const act = async (sessionId: string, action: "approve" | "reject" | "cancel" | "initiate") => {
    setActingId(sessionId)
    try {
      await fetch(`/api/platform/growth/voice/ai-outbound/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
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
      data-voice-ai-outbound-qa-marker={VOICE_AI_OUTBOUND_QA_MARKER}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <PhoneOutgoing className="size-4" />
        AI Outbound Approval Queue
      </p>
      <div className="space-y-2 rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-sm">
        <p className="text-xs text-muted-foreground">{queue.message}</p>
        <p className="text-xs text-muted-foreground">
          Pending: {queue.pendingApprovalCount} · Blocked: {queue.blockedCount}
        </p>
        {queue.pendingSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No outbound sessions awaiting approval.</p>
        ) : (
          <ul className="space-y-2">
            {queue.pendingSessions.map((session) => (
              <li key={session.id} className="rounded border border-border/50 px-2 py-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{session.phoneNumber}</span>
                  <GrowthBadge
                    label={session.outboundWorkflowType.replace(/_/g, " ")}
                    tone="neutral"
                  />
                  <GrowthBadge
                    label={session.outboundSessionStatus.replace(/_/g, " ")}
                    tone={sessionStatusTone(session.outboundSessionStatus)}
                  />
                  {session.manualReviewRequired ? (
                    <GrowthBadge label="manual review" tone="warning" />
                  ) : null}
                </div>
                {session.messagePreview ? (
                  <p className="mt-1 text-muted-foreground">Preview: {session.messagePreview}</p>
                ) : null}
                {session.complianceReasons.length > 0 ? (
                  <p className="mt-1 text-muted-foreground">
                    Compliance: {session.complianceReasons.join(", ")}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  {session.outboundSessionStatus === "pending_operator_approval" ? (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actingId === session.id}
                        data-qa-action="ai-outbound-approve"
                        onClick={() => void act(session.id, "approve")}
                      >
                        <Check className="mr-1 size-3" />
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actingId === session.id}
                        data-qa-action="ai-outbound-reject"
                        onClick={() => void act(session.id, "reject")}
                      >
                        <X className="mr-1 size-3" />
                        Reject
                      </Button>
                    </>
                  ) : null}
                  {session.outboundSessionStatus === "queued" ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={actingId === session.id}
                      data-qa-action="ai-outbound-initiate"
                      onClick={() => void act(session.id, "initiate")}
                    >
                      Initiate (supervised)
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={actingId === session.id}
                    onClick={() => void act(session.id, "cancel")}
                  >
                    Cancel
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
