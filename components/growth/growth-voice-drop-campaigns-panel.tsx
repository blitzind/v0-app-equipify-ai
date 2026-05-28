"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Plus, Voicemail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import type { VoiceDropCampaignDashboardSnapshot, VoiceDropCampaignPublicView } from "@/lib/voice/voice-drops/types"
import { VOICE_DROP_INFRASTRUCTURE_QA_MARKER } from "@/lib/voice/voice-drops/types"

export function GrowthVoiceDropCampaignsPanel() {
  const [dashboard, setDashboard] = useState<VoiceDropCampaignDashboardSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [draftName, setDraftName] = useState("")
  const [draftMessage, setDraftMessage] = useState(
    "Hi {{first_name}}, this is {{assigned_rep}} from our team. Please call us back at {{callback_number}} when convenient.",
  )
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/platform/growth/voice/voice-drops/campaigns", { cache: "no-store" })
      const data = (await res.json().catch(() => ({}))) as { dashboard?: VoiceDropCampaignDashboardSnapshot }
      if (res.ok && data.dashboard) setDashboard(data.dashboard)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createDraft = useCallback(async () => {
    setActing("create")
    setError(null)
    try {
      const res = await fetch("/api/platform/growth/voice/voice-drops/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: draftName, messageTemplate: draftMessage }),
      })
      const data = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        setError(data.message ?? "Failed to create campaign.")
        return
      }
      setDraftName("")
      await load()
    } finally {
      setActing(null)
    }
  }, [draftMessage, draftName, load])

  const campaignAction = useCallback(
    async (campaignId: string, action: string) => {
      setActing(`${action}:${campaignId}`)
      setError(null)
      try {
        const res = await fetch(`/api/platform/growth/voice/voice-drops/campaigns/${campaignId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        })
        const data = (await res.json().catch(() => ({}))) as { message?: string }
        if (!res.ok) setError(data.message ?? "Action failed.")
        await load()
      } finally {
        setActing(null)
      }
    },
    [load],
  )

  if (loading) {
    return <Loader2 className="size-5 animate-spin text-muted-foreground" />
  }

  return (
    <div
      className="space-y-6"
      data-voice-drop-infrastructure-qa-marker={VOICE_DROP_INFRASTRUCTURE_QA_MARKER}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Voicemail className="size-5" />
        <h2 className="text-lg font-semibold">Voice Drop Campaigns</h2>
        <GrowthBadge label="Approval required" tone="neutral" />
        <GrowthBadge label="Compliance-gated" tone="neutral" />
        <GrowthBadge label="No autonomous outbound" tone="neutral" />
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-3">
        <p className="text-sm font-medium">Draft campaign</p>
        <Input placeholder="Campaign name" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
        <Textarea
          placeholder="Message template with {{first_name}} tokens"
          value={draftMessage}
          onChange={(e) => setDraftMessage(e.target.value)}
          rows={3}
        />
        <Button type="button" disabled={acting != null || !draftName.trim()} onClick={() => void createDraft()}>
          {acting === "create" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
          Create draft
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="space-y-3">
        {(dashboard?.campaigns ?? []).map((campaign: VoiceDropCampaignPublicView) => (
          <div key={campaign.id} className="rounded-xl border border-border/60 px-4 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="font-medium">{campaign.name}</p>
              <GrowthBadge label={campaign.status.replace(/_/g, " ")} tone="neutral" />
              <GrowthBadge label={campaign.approvalStatus.replace(/_/g, " ")} tone="healthy" />
            </div>
            <p className="text-xs text-muted-foreground line-clamp-2">{campaign.messageTemplate}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Recipients: {campaign.recipientCount} · Suppressed: {campaign.suppressedCount} · Delivered:{" "}
              {campaign.deliveredCount}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {campaign.approvalStatus === "draft" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acting != null}
                  data-qa-action="voice-drop-submit-approval"
                  onClick={() => void campaignAction(campaign.id, "submit_for_approval")}
                >
                  Submit for approval
                </Button>
              ) : null}
              {campaign.approvalStatus === "pending_approval" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acting != null}
                  data-qa-action="voice-drop-approve"
                  onClick={() => void campaignAction(campaign.id, "approve")}
                >
                  Approve
                </Button>
              ) : null}
              {campaign.approvalStatus === "approved" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={acting != null}
                  data-qa-action="voice-drop-queue"
                  onClick={() => void campaignAction(campaign.id, "queue")}
                >
                  Queue delivery (approved)
                </Button>
              ) : null}
            </div>
          </div>
        ))}
        {(dashboard?.campaigns ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No voice drop campaigns yet. Create a draft to get started.</p>
        ) : null}
      </div>

      <p className="text-xs text-muted-foreground">{dashboard?.message}</p>
    </div>
  )
}
