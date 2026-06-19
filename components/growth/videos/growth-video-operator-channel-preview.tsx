"use client"

import type { GrowthVideoAutopilotChannelPreviewDraft } from "@/lib/growth/videos/growth-video-autopilot-draft-types"

export function GrowthVideoOperatorChannelPreview({
  channelPreview,
}: {
  channelPreview: GrowthVideoAutopilotChannelPreviewDraft
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div>
        <h3 className="text-sm font-semibold">Channel preview</h3>
        <p className="mt-1 text-xs text-muted-foreground capitalize">
          Primary channel: {channelPreview.channel.replace(/_/g, " ")}
        </p>
      </div>

      {channelPreview.emailHtml ? (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">Email</h4>
          <div
            className="mt-2 rounded-md border p-3 text-xs"
            dangerouslySetInnerHTML={{ __html: channelPreview.emailHtml }}
          />
        </section>
      ) : null}

      {channelPreview.smsText ? (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">SMS</h4>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{channelPreview.smsText}</pre>
        </section>
      ) : null}

      {channelPreview.voiceDropSummary ? (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">Voice</h4>
          <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
            {channelPreview.voiceDropSummary}
          </pre>
        </section>
      ) : null}

      {channelPreview.publicUrl ? (
        <p className="text-xs text-muted-foreground">Preview URL: {channelPreview.publicUrl}</p>
      ) : null}
    </div>
  )
}
