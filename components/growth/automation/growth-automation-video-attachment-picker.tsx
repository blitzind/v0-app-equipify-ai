"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, Loader2, RefreshCw, Trash2, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge, GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import {
  GROWTH_AUTOMATION_SEND_ACTION_TYPES,
  isSendAutomationActionConfig,
  type GrowthAutomationNode,
} from "@/lib/growth/automation/growth-automation-types"
import type {
  GrowthSequenceVideoAssetCatalogItem,
  GrowthSequenceVideoAttachmentType,
  GrowthSequenceVideoAttachmentView,
  GrowthSequenceVideoChannelPreview,
} from "@/lib/growth/sequences/growth-sequence-video-attachment-types"

type Props = {
  flowId: string
  node: GrowthAutomationNode | null
}

const ATTACHMENT_TYPE_LABELS: Record<GrowthSequenceVideoAttachmentType, string> = {
  email: "Email",
  sms: "SMS",
  voice_drop: "Voice Drop",
}

function resolveAttachmentTypeFromNode(
  node: GrowthAutomationNode | null,
): GrowthSequenceVideoAttachmentType | null {
  if (!node || !isSendAutomationActionConfig(node.configJson)) return null
  const actionType = typeof node.configJson.actionType === "string" ? node.configJson.actionType : ""
  if (actionType === "send_email") return "email"
  if (actionType === "send_sms") return "sms"
  if (actionType === "send_voice_drop") return "voice_drop"
  return null
}

function attachmentStatusTone(status: GrowthSequenceVideoAttachmentView["attachmentStatus"]) {
  if (status === "approved") return "healthy" as const
  if (status === "pending_approval") return "attention" as const
  return "neutral" as const
}

export function GrowthAutomationVideoAttachmentPicker({ flowId, node }: Props) {
  const attachmentType = resolveAttachmentTypeFromNode(node)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<GrowthSequenceVideoAssetCatalogItem[]>([])
  const [attachment, setAttachment] = useState<GrowthSequenceVideoAttachmentView | null>(null)
  const [preview, setPreview] = useState<GrowthSequenceVideoChannelPreview | null>(null)
  const [previewFirstName, setPreviewFirstName] = useState("John")
  const [selectedVideoPageId, setSelectedVideoPageId] = useState<string | null>(null)
  const [selectedVoiceMediaAssetId, setSelectedVoiceMediaAssetId] = useState<string | null>(null)
  const [selectedVideoAssetId, setSelectedVideoAssetId] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string>("")

  const videoPages = useMemo(
    () => catalog.filter((item) => item.kind === "video_page"),
    [catalog],
  )
  const voiceAssets = useMemo(
    () => catalog.filter((item) => item.kind === "voice_media"),
    [catalog],
  )
  const videoAssets = useMemo(
    () => catalog.filter((item) => item.kind === "video_asset"),
    [catalog],
  )
  const avatarAssets = useMemo(
    () => catalog.filter((item) => item.kind === "avatar_media"),
    [catalog],
  )

  const load = useCallback(async () => {
    if (!node || !attachmentType) {
      setCatalog([])
      setAttachment(null)
      setPreview(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        automation_flow_id: flowId,
        automation_node_id: node.id,
      })
      const listRes = await fetch(`/api/growth/sequences/video-assets?${params.toString()}`)
      const listData = (await listRes.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        attachments?: GrowthSequenceVideoAttachmentView[]
        catalog?: GrowthSequenceVideoAssetCatalogItem[] | null
      }
      if (!listRes.ok || !listData.ok) {
        throw new Error(listData.message ?? "Could not load video attachments.")
      }

      setCatalog(listData.catalog ?? [])
      const current =
        listData.attachments?.find(
          (item) => item.attachmentType === attachmentType && item.attachmentStatus !== "removed",
        ) ?? null
      setAttachment(current)
      setSelectedVideoPageId(current?.videoPageId ?? null)
      setSelectedVoiceMediaAssetId(current?.voiceMediaAssetId ?? null)
      setSelectedVideoAssetId(current?.videoAssetId ?? null)
      setThumbnailUrl(current?.thumbnailUrl ?? "")

      const previewParams = new URLSearchParams({
        attachment_type: attachmentType,
        preview_first_name: previewFirstName,
      })
      if (current?.id) previewParams.set("attachment_id", current.id)
      if (current?.videoPageId) previewParams.set("video_page_id", current.videoPageId)
      if (current?.voiceMediaAssetId) previewParams.set("voice_media_asset_id", current.voiceMediaAssetId)
      if (current?.thumbnailUrl) previewParams.set("thumbnail_url", current.thumbnailUrl)

      const previewRes = await fetch(`/api/growth/sequences/video-assets/preview?${previewParams.toString()}`)
      const previewData = (await previewRes.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        channelPreview?: GrowthSequenceVideoChannelPreview | null
      }
      if (previewRes.ok && previewData.ok) {
        setPreview(previewData.channelPreview ?? null)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed.")
    } finally {
      setLoading(false)
    }
  }, [attachmentType, flowId, node, previewFirstName])

  useEffect(() => {
    void load()
  }, [load])

  async function refreshPreview(next?: {
    videoPageId?: string | null
    voiceMediaAssetId?: string | null
    thumbnailUrl?: string | null
  }) {
    if (!attachmentType) return
    const params = new URLSearchParams({
      attachment_type: attachmentType,
      preview_first_name: previewFirstName,
    })
    if (attachment?.id) params.set("attachment_id", attachment.id)
    const videoPageId = next?.videoPageId ?? selectedVideoPageId
    const voiceMediaAssetId = next?.voiceMediaAssetId ?? selectedVoiceMediaAssetId
    const thumb = next?.thumbnailUrl ?? thumbnailUrl
    if (videoPageId) params.set("video_page_id", videoPageId)
    if (voiceMediaAssetId) params.set("voice_media_asset_id", voiceMediaAssetId)
    if (thumb) params.set("thumbnail_url", thumb)

    const res = await fetch(`/api/growth/sequences/video-assets/preview?${params.toString()}`)
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      channelPreview?: GrowthSequenceVideoChannelPreview | null
    }
    if (res.ok && data.ok) setPreview(data.channelPreview ?? null)
  }

  async function attachSelected() {
    if (!node || !attachmentType) return
    setActing(true)
    setError(null)
    try {
      const res = await fetch("/api/growth/sequences/video-assets/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          automation_flow_id: flowId,
          automation_node_id: node.id,
          sequence_pattern_step_id: node.compiledPatternStepId,
          attachment_type: attachmentType,
          video_asset_id: selectedVideoAssetId,
          video_page_id: selectedVideoPageId,
          voice_media_asset_id: selectedVoiceMediaAssetId,
          thumbnail_url: thumbnailUrl.trim() || null,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        attachment?: GrowthSequenceVideoAttachmentView
      }
      if (!res.ok || !data.ok || !data.attachment) {
        throw new Error(data.message ?? "Attach failed.")
      }
      setAttachment(data.attachment)
      await refreshPreview({
        videoPageId: data.attachment.videoPageId,
        voiceMediaAssetId: data.attachment.voiceMediaAssetId,
        thumbnailUrl: data.attachment.thumbnailUrl,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Attach failed.")
    } finally {
      setActing(false)
    }
  }

  async function reviewAttachment(action: "approve" | "remove" | "replace") {
    if (!attachment?.id) return
    setActing(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {
        attachment_id: attachment.id,
        action,
      }
      if (action === "replace") {
        body.replace_with = {
          automation_flow_id: flowId,
          automation_node_id: node?.id,
          sequence_pattern_step_id: node?.compiledPatternStepId ?? null,
          attachment_type: attachmentType,
          video_asset_id: selectedVideoAssetId,
          video_page_id: selectedVideoPageId,
          voice_media_asset_id: selectedVoiceMediaAssetId,
          thumbnail_url: thumbnailUrl.trim() || null,
        }
      }

      const res = await fetch("/api/growth/sequences/video-assets/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        message?: string
        attachment?: GrowthSequenceVideoAttachmentView
      }
      if (!res.ok || !data.ok || !data.attachment) {
        throw new Error(data.message ?? "Review action failed.")
      }
      setAttachment(data.attachment)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review action failed.")
    } finally {
      setActing(false)
    }
  }

  if (!node) {
    return (
      <GrowthEngineCard title="Video attachment">
        <p className="text-sm text-muted-foreground">Select a send step to attach a personalized video asset.</p>
      </GrowthEngineCard>
    )
  }

  if (!attachmentType) {
    return (
      <GrowthEngineCard title="Video attachment">
        <p className="text-sm text-muted-foreground">
          Video attachments are available on send steps ({GROWTH_AUTOMATION_SEND_ACTION_TYPES.slice(0, 3).join(", ")}).
        </p>
      </GrowthEngineCard>
    )
  }

  return (
    <GrowthEngineCard title="Video attachment" icon={<Video className="size-4" />}>
      {error ? (
        <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center gap-2">
          <GrowthBadge label={ATTACHMENT_TYPE_LABELS[attachmentType]} tone="neutral" />
          {attachment ? (
            <GrowthBadge
              label={attachment.attachmentStatus.replace(/_/g, " ")}
              tone={attachmentStatusTone(attachment.attachmentStatus)}
            />
          ) : (
            <GrowthBadge label="No attachment" tone="neutral" />
          )}
          <Button type="button" size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={() => void load()}>
            {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
          </Button>
        </div>

        <div className="space-y-4">
          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Video assets</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading catalog…</p>
            ) : (
              <div className="space-y-3">
                {(attachmentType === "email" || attachmentType === "sms") && (
                  <div className="space-y-1">
                    <Label className="text-xs">Video page</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={selectedVideoPageId ?? ""}
                      onChange={(e) => {
                        const next = e.target.value || null
                        setSelectedVideoPageId(next)
                        void refreshPreview({ videoPageId: next })
                      }}
                    >
                      <option value="">Select video page…</option>
                      {videoPages.map((item) => (
                        <option key={item.id} value={item.videoPageId ?? item.id}>
                          {item.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {attachmentType === "voice_drop" && (
                  <div className="space-y-1">
                    <Label className="text-xs">Voice asset</Label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                      value={selectedVoiceMediaAssetId ?? ""}
                      onChange={(e) => {
                        const next = e.target.value || null
                        setSelectedVoiceMediaAssetId(next)
                        void refreshPreview({ voiceMediaAssetId: next })
                      }}
                    >
                      <option value="">Select voice asset…</option>
                      {voiceAssets.map((item) => (
                        <option key={item.id} value={item.mediaAssetId ?? item.id}>
                          {item.title}
                          {item.dryRun ? " (dry-run)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">Source video asset (optional)</Label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={selectedVideoAssetId ?? ""}
                    onChange={(e) => setSelectedVideoAssetId(e.target.value || null)}
                  >
                    <option value="">None</option>
                    {videoAssets.map((item) => (
                      <option key={item.id} value={item.videoAssetId ?? item.id}>
                        {item.title}
                      </option>
                    ))}
                  </select>
                </div>

                {(attachmentType === "email" || attachmentType === "sms") && (
                  <div className="space-y-1">
                    <Label className="text-xs">Thumbnail URL (optional)</Label>
                    <Input
                      value={thumbnailUrl}
                      onChange={(e) => {
                        setThumbnailUrl(e.target.value)
                        void refreshPreview({ thumbnailUrl: e.target.value })
                      }}
                      placeholder="https://…"
                    />
                  </div>
                )}

                {avatarAssets.length > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {avatarAssets.length} avatar video(s) in catalog — not rendered in {ATTACHMENT_TYPE_LABELS[attachmentType]} channel.
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</h4>
              <Input
                className="h-7 max-w-[120px] text-xs"
                value={previewFirstName}
                onChange={(e) => setPreviewFirstName(e.target.value)}
                onBlur={() => void refreshPreview()}
                placeholder="First name"
              />
            </div>
            {preview?.channel === "email" && preview.emailHtml ? (
              <div
                className="rounded-md border border-border bg-muted/20 p-3 text-sm"
                dangerouslySetInnerHTML={{ __html: preview.emailHtml }}
              />
            ) : null}
            {preview?.channel === "sms" && preview.smsText ? (
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3 text-xs">
                {preview.smsText}
              </pre>
            ) : null}
            {preview?.channel === "voice_drop" && preview.voiceDropSummary ? (
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/20 p-3 text-xs">
                {preview.voiceDropSummary}
              </pre>
            ) : null}
            {!preview ? <p className="text-sm text-muted-foreground">Select assets to preview channel rendering.</p> : null}
          </section>

          <section className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval</h4>
            <p className="text-[11px] text-muted-foreground">
              Attachments require operator approval before use. No outbound send is triggered from this panel.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" disabled={acting} onClick={() => void attachSelected()}>
                {acting ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : null}
                Save attachment
              </Button>
              {attachment && attachment.attachmentStatus !== "approved" ? (
                <Button type="button" size="sm" variant="secondary" disabled={acting} onClick={() => void reviewAttachment("approve")}>
                  <Check className="mr-1 size-3.5" /> Approve
                </Button>
              ) : null}
              {attachment && attachment.attachmentStatus !== "removed" ? (
                <>
                  <Button type="button" size="sm" variant="outline" disabled={acting} onClick={() => void reviewAttachment("replace")}>
                    Replace
                  </Button>
                  <Button type="button" size="sm" variant="destructive" disabled={acting} onClick={() => void reviewAttachment("remove")}>
                    <Trash2 className="mr-1 size-3.5" /> Remove
                  </Button>
                </>
              ) : null}
            </div>
          </section>
        </div>
      </GrowthEngineCard>
  )
}
