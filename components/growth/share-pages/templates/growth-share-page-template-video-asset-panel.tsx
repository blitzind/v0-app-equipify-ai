"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { GrowthMediaRecordingUploadPanel } from "@/components/growth/media/growth-media-recording-upload-panel"
import { GrowthMediaVideoThumbnailPanel } from "@/components/growth/media/growth-media-video-thumbnail-panel"
import { GrowthMediaVideoOverlayBuilder } from "@/components/growth/media/growth-media-video-overlay-builder"
import { GrowthMediaAiVideoPanel } from "@/components/growth/media/growth-media-ai-video-panel"
import { GrowthMediaAiVoicePanel } from "@/components/growth/media/growth-media-ai-voice-panel"
import { GrowthMediaConversationalAgentPanel } from "@/components/growth/media/growth-media-conversational-agent-panel"
import { GrowthMediaAiQaPanel } from "@/components/growth/media/growth-media-ai-qa-panel"
import { GrowthMediaBookingHandoffPanel } from "@/components/growth/media/growth-media-booking-handoff-panel"
import type { GrowthSharePageTemplateVideoPlaceholderBlock } from "@/lib/growth/share-pages/share-page-template-block-types"
import type { GrowthMediaVideoAssetSummary } from "@/lib/growth/media/media-video-upload-types"
import {
  buildSharePageTemplatePreviewMergeValues,
  DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT,
} from "@/lib/growth/share-pages/share-page-template-preview-context"
import { createDefaultVideoOverlaySpec, normalizeVideoOverlaySpec } from "@/lib/growth/media/media-video-overlay-utils"

type VideoAssetResponse = {
  ok: boolean
  asset?: GrowthMediaVideoAssetSummary
  upload_state?: string
  metadata?: Record<string, unknown>
  message?: string
}

export function GrowthSharePageTemplateVideoAssetPanel({
  block,
  disabled,
  onChange,
}: {
  block: GrowthSharePageTemplateVideoPlaceholderBlock
  disabled?: boolean
  onChange: (next: GrowthSharePageTemplateVideoPlaceholderBlock) => void
}) {
  const assetId = block.videoAssetId ?? block.mediaAssetRef
  const overlaySpec = normalizeVideoOverlaySpec(block.settings?.overlaySpec ?? createDefaultVideoOverlaySpec())
  const mergeValues = useMemo(
    () => buildSharePageTemplatePreviewMergeValues(DEFAULT_GROWTH_SHARE_PAGE_TEMPLATE_PREVIEW_CONTEXT),
    [],
  )
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null)
  const [showRecorder, setShowRecorder] = useState(false)
  const [localVideoBlob, setLocalVideoBlob] = useState<Blob | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<GrowthMediaVideoAssetSummary | null>(null)
  const [uploadState, setUploadState] = useState<string | null>(null)

  useEffect(() => {
    if (!assetId) {
      setSummary(null)
      setUploadState(null)
      setError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    void fetch(`/api/platform/growth/media-assets/video/${assetId}`)
      .then((res) => res.json() as Promise<VideoAssetResponse>)
      .then((data) => {
        if (cancelled) return
        if (!data.ok || !data.asset) {
          setError(data.message ?? "Could not load video asset metadata.")
          setSummary(null)
          setUploadState(null)
          return
        }
        setSummary(data.asset)
        setUploadState(data.upload_state ?? data.asset.status)
        setError(null)
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load video asset metadata.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [assetId])

  useEffect(() => {
    if (!assetId) {
      setThumbnailPreviewUrl(null)
      return
    }
    let cancelled = false
    void fetch(`/api/platform/growth/media-assets/video/${assetId}/thumbnail`)
      .then((res) => res.json() as Promise<{ ok?: boolean; thumbnail?: { previewUrl?: string | null } }>)
      .then((data) => {
        if (!cancelled) setThumbnailPreviewUrl(data.thumbnail?.previewUrl ?? null)
      })
      .catch(() => {
        if (!cancelled) setThumbnailPreviewUrl(null)
      })
    return () => {
      cancelled = true
    }
  }, [assetId])

  const attachAsset = (id: string, asset: GrowthMediaVideoAssetSummary, sourceBlob?: Blob | null) => {
    onChange({
      ...block,
      videoAssetId: id,
      mediaAssetRef: id,
    })
    setSummary(asset)
    setUploadState(asset.status)
    setLocalVideoBlob(sourceBlob ?? null)
    setError(null)
    setShowRecorder(false)
  }

  return (
    <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
      <div>
        <p className="text-sm font-medium">Video asset (S2-A / S2-B / S2-C)</p>
        <p className="text-xs text-muted-foreground">
          Attach, record, or manage thumbnails — static image preview only, no video playback.
        </p>
      </div>

      <input
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={assetId ?? ""}
        disabled={disabled}
        placeholder="Video asset UUID"
        onChange={(e) => {
          const nextId = e.target.value.trim() || null
          onChange({
            ...block,
            videoAssetId: nextId,
            mediaAssetRef: nextId,
          })
          if (!nextId) setLocalVideoBlob(null)
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={showRecorder ? "secondary" : "outline"}
          disabled={disabled}
          onClick={() => setShowRecorder((value) => !value)}
        >
          {showRecorder ? "Hide recorder" : "Record video"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !assetId}
          onClick={() => {
            onChange({ ...block, videoAssetId: null, mediaAssetRef: null })
            setSummary(null)
            setUploadState(null)
            setLocalVideoBlob(null)
            setError(null)
          }}
        >
          Remove video asset
        </Button>
      </div>

      {showRecorder ? (
        <GrowthMediaRecordingUploadPanel
          disabled={disabled}
          title={block.heading ?? block.placeholderLabel ?? "Template video recording"}
          onUploadComplete={attachAsset}
        />
      ) : null}

      <GrowthMediaVideoThumbnailPanel
        videoAssetId={assetId}
        disabled={disabled}
        localVideoBlob={localVideoBlob}
      />

      {loading ? <p className="text-xs text-muted-foreground">Loading upload state…</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {summary ? (
        <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Status:</span> {uploadState ?? summary.status}
          </p>
          <p>
            <span className="font-medium text-foreground">File:</span>{" "}
            {summary.originalFilename ?? summary.title} ({summary.mimeType ?? "video/mp4"})
          </p>
          <p>
            <span className="font-medium text-foreground">Size:</span>{" "}
            {summary.fileSizeBytes != null ? `${summary.fileSizeBytes} bytes` : "pending"}
          </p>
          {summary.durationSeconds != null ? (
            <p>
              <span className="font-medium text-foreground">Duration:</span> {summary.durationSeconds}s
            </p>
          ) : null}
          {summary.width != null && summary.height != null ? (
            <p>
              <span className="font-medium text-foreground">Dimensions:</span> {summary.width}×{summary.height}
            </p>
          ) : null}
          {summary.checksumSha256 ? (
            <p className="truncate">
              <span className="font-medium text-foreground">Checksum:</span> {summary.checksumSha256}
            </p>
          ) : null}
        </div>
      ) : null}

      <GrowthMediaVideoOverlayBuilder
        overlaySpec={overlaySpec}
        mergeValues={mergeValues}
        thumbnailPreviewUrl={thumbnailPreviewUrl}
        layout={block.layout ?? "wide"}
        disabled={disabled}
        onChange={(nextOverlaySpec) =>
          onChange({
            ...block,
            settings: {
              ...block.settings,
              overlaySpec: nextOverlaySpec,
            },
          })
        }
      />

      <GrowthMediaAiVideoPanel
        aiVideo={block.settings?.aiVideo}
        mergeValues={mergeValues}
        disabled={disabled}
        onChange={(nextAiVideo) =>
          onChange({
            ...block,
            settings: {
              ...block.settings,
              aiVideo: nextAiVideo,
            },
          })
        }
      />

      <GrowthMediaAiVoicePanel
        voiceClone={block.settings?.aiVideo?.voiceClone}
        mergeValues={mergeValues}
        disabled={disabled}
        onChange={(nextVoiceClone) =>
          onChange({
            ...block,
            settings: {
              ...block.settings,
              aiVideo: {
                enabled: block.settings?.aiVideo?.enabled ?? false,
                avatarId: block.settings?.aiVideo?.avatarId ?? null,
                scriptTemplate: block.settings?.aiVideo?.scriptTemplate ?? null,
                mergeFieldsUsed: block.settings?.aiVideo?.mergeFieldsUsed ?? [],
                ...block.settings?.aiVideo,
                voiceClone: nextVoiceClone,
              },
            },
          })
        }
      />

      <GrowthMediaConversationalAgentPanel
        conversationalAgent={block.settings?.aiVideo?.conversationalAgent}
        mergeValues={mergeValues}
        disabled={disabled}
        onChange={(nextConversationalAgent) =>
          onChange({
            ...block,
            settings: {
              ...block.settings,
              aiVideo: {
                enabled: block.settings?.aiVideo?.enabled ?? false,
                avatarId: block.settings?.aiVideo?.avatarId ?? null,
                scriptTemplate: block.settings?.aiVideo?.scriptTemplate ?? null,
                mergeFieldsUsed: block.settings?.aiVideo?.mergeFieldsUsed ?? [],
                ...block.settings?.aiVideo,
                conversationalAgent: nextConversationalAgent,
              },
            },
          })
        }
      />

      <GrowthMediaAiQaPanel
        aiQa={block.settings?.aiVideo?.conversationalAgent?.aiQa}
        mergeValues={mergeValues}
        qualificationGoal={block.settings?.aiVideo?.conversationalAgent?.qualificationGoal}
        disabled={disabled}
        onChange={(nextAiQa) =>
          onChange({
            ...block,
            settings: {
              ...block.settings,
              aiVideo: {
                enabled: block.settings?.aiVideo?.enabled ?? false,
                avatarId: block.settings?.aiVideo?.avatarId ?? null,
                scriptTemplate: block.settings?.aiVideo?.scriptTemplate ?? null,
                mergeFieldsUsed: block.settings?.aiVideo?.mergeFieldsUsed ?? [],
                ...block.settings?.aiVideo,
                conversationalAgent: {
                  enabled: block.settings?.aiVideo?.conversationalAgent?.enabled ?? false,
                  agentId: block.settings?.aiVideo?.conversationalAgent?.agentId ?? null,
                  qualificationGoal: block.settings?.aiVideo?.conversationalAgent?.qualificationGoal ?? null,
                  systemPromptTemplate: block.settings?.aiVideo?.conversationalAgent?.systemPromptTemplate ?? null,
                  mergeFieldsUsed: block.settings?.aiVideo?.conversationalAgent?.mergeFieldsUsed ?? [],
                  ...block.settings?.aiVideo?.conversationalAgent,
                  aiQa: nextAiQa,
                },
              },
            },
          })
        }
      />

      <GrowthMediaBookingHandoffPanel
        bookingHandoff={block.settings?.aiVideo?.conversationalAgent?.bookingHandoff}
        mergeValues={mergeValues}
        qualificationGoal={block.settings?.aiVideo?.conversationalAgent?.qualificationGoal}
        aiQaEnabled={block.settings?.aiVideo?.conversationalAgent?.aiQa?.enabled}
        conversationEnabled={block.settings?.aiVideo?.conversationalAgent?.enabled}
        disabled={disabled}
        onChange={(nextBookingHandoff) =>
          onChange({
            ...block,
            settings: {
              ...block.settings,
              aiVideo: {
                enabled: block.settings?.aiVideo?.enabled ?? false,
                avatarId: block.settings?.aiVideo?.avatarId ?? null,
                scriptTemplate: block.settings?.aiVideo?.scriptTemplate ?? null,
                mergeFieldsUsed: block.settings?.aiVideo?.mergeFieldsUsed ?? [],
                ...block.settings?.aiVideo,
                conversationalAgent: {
                  enabled: block.settings?.aiVideo?.conversationalAgent?.enabled ?? false,
                  agentId: block.settings?.aiVideo?.conversationalAgent?.agentId ?? null,
                  qualificationGoal: block.settings?.aiVideo?.conversationalAgent?.qualificationGoal ?? null,
                  systemPromptTemplate: block.settings?.aiVideo?.conversationalAgent?.systemPromptTemplate ?? null,
                  mergeFieldsUsed: block.settings?.aiVideo?.conversationalAgent?.mergeFieldsUsed ?? [],
                  ...block.settings?.aiVideo?.conversationalAgent,
                  bookingHandoff: nextBookingHandoff,
                },
              },
            },
          })
        }
      />
    </div>
  )
}
