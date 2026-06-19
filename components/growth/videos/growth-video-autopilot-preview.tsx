"use client"

import type {
  GrowthVideoAutopilotPreviewBundle,
  GrowthVideoAutopilotRecommendation,
} from "@/lib/growth/videos/growth-video-autopilot-types"

export function GrowthVideoAutopilotPreview({
  preview,
  recommendation,
}: {
  preview: GrowthVideoAutopilotPreviewBundle
  recommendation: GrowthVideoAutopilotRecommendation | null
}) {
  return (
    <div className="mt-6 space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Script preview</h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
          {preview.scriptPreview ?? "No script preview available."}
        </pre>
      </div>

      {preview.thumbnailPreviewDataUrl ? (
        <div>
          <h3 className="text-sm font-semibold">Thumbnail preview</h3>
          <img
            src={preview.thumbnailPreviewDataUrl}
            alt="Recommended thumbnail preview"
            className="mt-2 max-w-md rounded-md border"
          />
        </div>
      ) : null}

      {preview.overlayPreviewHtml ? (
        <div>
          <h3 className="text-sm font-semibold">Overlay preview</h3>
          <div
            className="mt-2 rounded-md border p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: preview.overlayPreviewHtml }}
          />
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {preview.channelPreview.emailHtml ? (
          <div>
            <h3 className="text-sm font-semibold">Email preview</h3>
            <div
              className="mt-2 rounded-md border p-3 text-xs"
              dangerouslySetInnerHTML={{ __html: preview.channelPreview.emailHtml }}
            />
          </div>
        ) : null}
        {preview.channelPreview.smsText ? (
          <div>
            <h3 className="text-sm font-semibold">SMS preview</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {preview.channelPreview.smsText}
            </pre>
          </div>
        ) : null}
        {preview.channelPreview.voiceDropSummary ? (
          <div>
            <h3 className="text-sm font-semibold">Voice preview</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {preview.channelPreview.voiceDropSummary}
            </pre>
          </div>
        ) : null}
      </div>

      <div className="text-xs text-muted-foreground">
        Voice preview available: {preview.voicePreviewAvailable ? "yes" : "no"} · Avatar preview available:{" "}
        {preview.avatarPreviewAvailable ? "yes" : "no"}
        {recommendation ? (
          <>
            {" "}
            · Recommendation status: {recommendation.status}
          </>
        ) : null}
      </div>
    </div>
  )
}
