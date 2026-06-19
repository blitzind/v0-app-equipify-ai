"use client"

import type { GrowthVideoAutopilotDraftPackage } from "@/lib/growth/videos/growth-video-autopilot-draft-types"

export function GrowthVideoOperatorAssetReview({ draft }: { draft: GrowthVideoAutopilotDraftPackage }) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">Asset review</h3>

      <section>
        <h4 className="text-xs font-medium text-muted-foreground">Script</h4>
        <pre className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
          {draft.scriptDraft.script ?? "No script draft."}
        </pre>
      </section>

      {draft.thumbnailDraft.previewDataUrl ? (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">Thumbnail</h4>
          <img
            src={draft.thumbnailDraft.previewDataUrl}
            alt="Thumbnail draft"
            className="mt-2 max-w-full rounded-md border"
          />
        </section>
      ) : null}

      {draft.overlayDraft.previewHtml ? (
        <section>
          <h4 className="text-xs font-medium text-muted-foreground">Overlay</h4>
          <div
            className="mt-2 rounded-md border p-3 text-sm"
            dangerouslySetInnerHTML={{ __html: draft.overlayDraft.previewHtml }}
          />
        </section>
      ) : null}

      <section>
        <h4 className="text-xs font-medium text-muted-foreground">Page preview</h4>
        <dl className="mt-2 grid gap-1 text-xs">
          <div>
            <dt className="inline font-medium">Title:</dt> <dd className="inline">{draft.pageDraft.title ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Slug:</dt> <dd className="inline">{draft.pageDraft.slug ?? "—"}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Published:</dt>{" "}
            <dd className="inline">{draft.pageDraft.published ? "yes" : "no"}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <MediaDraftCard title="Voice draft" draft={draft.voiceDraft} />
        <MediaDraftCard title="Avatar draft" draft={draft.avatarDraft} />
      </section>

      <section>
        <h4 className="text-xs font-medium text-muted-foreground">Sequence attachment</h4>
        <dl className="mt-2 grid gap-1 text-xs">
          <div>
            <dt className="inline font-medium">Status:</dt>{" "}
            <dd className="inline capitalize">{draft.attachmentDraft.attachmentStatus.replace(/_/g, " ")}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Channel:</dt>{" "}
            <dd className="inline">{draft.attachmentDraft.attachmentType}</dd>
          </div>
          <div>
            <dt className="inline font-medium">Attachment ID:</dt>{" "}
            <dd className="inline">{draft.attachmentDraft.sequenceAttachmentId ?? "metadata only"}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}

function MediaDraftCard({
  title,
  draft,
}: {
  title: string
  draft: GrowthVideoAutopilotDraftPackage["voiceDraft"]
}) {
  if (!draft) {
    return (
      <div className="rounded-md border p-3 text-xs text-muted-foreground">
        <div className="font-medium text-foreground">{title}</div>
        <p className="mt-1">Not requested</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border p-3 text-xs">
      <div className="font-medium">{title}</div>
      <p className="mt-1 capitalize">Status: {draft.status}</p>
      <p>Queued: {draft.queued ? "yes" : "no"}</p>
      <p>Worker execution: disabled</p>
    </div>
  )
}
