"use client"

import { useCallback, useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthSendrAssetPickerPanel } from "@/components/growth/sendr/growth-sendr-asset-picker-panel"
import type { GrowthSendrAssetPickerItem, GrowthSendrLandingPageSection } from "@/lib/growth/sendr/growth-sendr-types"
import {
  buildGrowthVideoLibraryHref,
  buildGrowthVideoRecordHref,
  buildSendrVideoReturnContextForPage,
} from "@/lib/growth/sendr/growth-sendr-video-return-flow"

type Props = {
  pageId: string
  section: GrowthSendrLandingPageSection
  disabled?: boolean
  onUpdated: () => void
  onMessage: (message: string | null) => void
}

function sectionGrowthVideoId(section: GrowthSendrLandingPageSection): string | null {
  if (typeof section.content.growthVideoAssetId === "string") {
    return section.content.growthVideoAssetId
  }
  return null
}

export function GrowthSendrSectionVideoEditor({
  pageId,
  section,
  disabled,
  onUpdated,
  onMessage,
}: Props) {
  const [busy, setBusy] = useState(false)
  const returnContext = buildSendrVideoReturnContextForPage({
    landingPageId: pageId,
    sectionId: section.id,
  })
  const selectedId = sectionGrowthVideoId(section)
  const videoTitle =
    typeof section.content.videoTitle === "string" ? section.content.videoTitle : null

  const attachGrowthVideo = useCallback(
    async (growthVideoAssetId: string) => {
      setBusy(true)
      onMessage(null)
      try {
        const res = await fetch("/api/platform/growth/sendr/video-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "attach_growth_video_section",
            landingPageId: pageId,
            sectionId: section.id,
            growthVideoAssetId,
          }),
        })
        const data = (await res.json()) as { ok: boolean; message?: string }
        if (!res.ok) {
          onMessage(data.message ?? "Section video attach failed")
          return
        }
        onMessage("Section video attached")
        onUpdated()
      } finally {
        setBusy(false)
      }
    },
    [onMessage, onUpdated, pageId, section.id],
  )

  async function handleSelect(item: GrowthSendrAssetPickerItem) {
    if (item.assetKind !== "video") return
    if (item.metadata.source === "growth_library") {
      await attachGrowthVideo(item.id)
      return
    }
    onMessage("Use Growth Video library assets for section video sections.")
  }

  async function removeVideo() {
    setBusy(true)
    onMessage(null)
    try {
      const res = await fetch("/api/platform/growth/sendr/video-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "detach_section_video",
          landingPageId: pageId,
          sectionId: section.id,
        }),
      })
      const data = (await res.json()) as { ok: boolean; message?: string }
      if (!res.ok) {
        onMessage(data.message ?? "Section video remove failed")
        return
      }
      onMessage("Section video removed")
      onUpdated()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-dashed p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Section video</p>
        {selectedId ? (
          <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={() => void removeVideo()}>
            Remove video
          </Button>
        ) : null}
      </div>

      {selectedId ? (
        <p className="text-sm">
          Attached: {videoTitle ?? selectedId}
          {typeof section.content.durationSeconds === "number"
            ? ` · ${section.content.durationSeconds}s`
            : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Record, upload, or select a Growth Video asset for this section.
        </p>
      )}

      {busy ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Updating section video…
        </div>
      ) : null}

      <GrowthSendrAssetPickerPanel
        kind="video"
        selectedId={selectedId}
        disabled={disabled || busy}
        showVideoShortcuts
        attachLabel={selectedId ? "Replace" : "Attach"}
        returnContext={returnContext}
        onSelect={(item) => void handleSelect(item)}
      />
    </div>
  )
}
