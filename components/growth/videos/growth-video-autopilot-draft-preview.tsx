"use client"

import type { GrowthVideoAutopilotDraftPackage } from "@/lib/growth/videos/growth-video-autopilot-draft-types"

export function GrowthVideoAutopilotDraftPreview({ draft }: { draft: GrowthVideoAutopilotDraftPackage }) {
  return (
    <div className="mt-6 space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>Status: {draft.status}</span>
        <span>·</span>
        <span>Attachment: {draft.attachmentDraft.attachmentStatus}</span>
        <span>·</span>
        <span>Worker execution: {draft.workerExecutionEnabled ? "enabled" : "disabled"}</span>
      </div>

      <div>
        <h3 className="text-sm font-semibold">Script draft</h3>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
          {draft.scriptDraft.script ?? "No script draft."}
        </pre>
      </div>

      {draft.thumbnailDraft.previewDataUrl ? (
        <div>
          <h3 className="text-sm font-semibold">Thumbnail draft</h3>
          <img
            src={draft.thumbnailDraft.previewDataUrl}
            alt="Draft thumbnail preview"
            className="mt-2 max-w-md rounded-md border"
          />
        </div>
      ) : null}

      {draft.overlayDraft.previewHtml ? (
        <div>
          <h3 className="text-sm font-semibold">Overlay draft</h3>
          <div
            className="mt-2 rounded-md border p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: draft.overlayDraft.previewHtml }}
          />
        </div>
      ) : null}

      <div>
        <h3 className="text-sm font-semibold">Video page draft</h3>
        <dl className="mt-2 grid gap-1 text-xs">
          <div>
            <dt className="inline font-medium">Title:</dt>{" "}
            <dd className="inline">{draft.pageDraft.title ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Slug:</dt>{" "}
            <dd className="inline">{draft.pageDraft.slug ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Published:</dt>{" "}
            <dd className="inline">{draft.pageDraft.published ? "yes" : "no"}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {draft.voiceDraft ? (
          <div>
            <h3 className="text-sm font-semibold">Voice draft</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Status: {draft.voiceDraft.status} · Queued: {draft.voiceDraft.queued ? "yes" : "no"}
            </p>
          </div>
        ) : null}
        {draft.avatarDraft ? (
          <div>
            <h3 className="text-sm font-semibold">Avatar draft</h3>
            <p className="mt-2 text-xs text-muted-foreground">
              Status: {draft.avatarDraft.status} · Queued: {draft.avatarDraft.queued ? "yes" : "no"}
            </p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {draft.channelPreviewDraft.emailHtml ? (
          <div>
            <h3 className="text-sm font-semibold">Email preview</h3>
            <div
              className="mt-2 rounded-md border p-3 text-xs"
              dangerouslySetInnerHTML={{ __html: draft.channelPreviewDraft.emailHtml }}
            />
          </div>
        ) : null}
        {draft.channelPreviewDraft.smsText ? (
          <div>
            <h3 className="text-sm font-semibold">SMS preview</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {draft.channelPreviewDraft.smsText}
            </pre>
          </div>
        ) : null}
        {draft.channelPreviewDraft.voiceDropSummary ? (
          <div>
            <h3 className="text-sm font-semibold">Voice preview</h3>
            <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {draft.channelPreviewDraft.voiceDropSummary}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}
