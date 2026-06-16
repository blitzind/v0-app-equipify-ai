"use client"

import { AlertTriangle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GrowthSharePageTemplateVersionDiff } from "@/components/growth/share-pages/templates/growth-share-page-template-version-diff"
import {
  metadataFromTemplate,
  nextPublishVersionNumber,
  summarizeSharePageTemplateVersionDiff,
} from "@/lib/growth/share-pages/share-page-template-version-diff"
import {
  hasUnpublishedSharePageTemplateDraft,
  type GrowthSharePageTemplate,
  type GrowthSharePageTemplateVersion,
} from "@/lib/growth/share-pages/share-page-template-types"

export function GrowthSharePageTemplatePublishDialog({
  open,
  onOpenChange,
  template,
  versions,
  publishSummary,
  onPublishSummaryChange,
  publishing,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: GrowthSharePageTemplate | null
  versions: GrowthSharePageTemplateVersion[]
  publishSummary: string
  onPublishSummaryChange: (value: string) => void
  publishing?: boolean
  onConfirm: () => void
}) {
  const currentVersion = template?.currentVersion ?? null
  const publishedVersion = template?.publishedVersion ?? null
  const nextVersionNumber = nextPublishVersionNumber(template, versions)
  const unpublishedDraftWarning = template ? hasUnpublishedSharePageTemplateDraft(template) : false

  const diffSummary =
    template && currentVersion
      ? summarizeSharePageTemplateVersionDiff({
          before: publishedVersion,
          after: currentVersion,
          metadataBefore: publishedVersion ? metadataFromTemplate(template) : null,
          metadataAfter: metadataFromTemplate(template),
        })
      : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish template</DialogTitle>
          <DialogDescription>
            This publishes the template layout to the library only. It does not create or publish live share pages.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <GrowthBadge
              tone="neutral"
              label={`Current: v${currentVersion?.versionNumber ?? "—"} (${currentVersion?.status ?? "none"})`}
            />
            <GrowthBadge tone="healthy" label={`Next publish: v${nextVersionNumber}`} />
            {publishedVersion ? (
              <GrowthBadge tone="neutral" label={`Live published: v${publishedVersion.versionNumber}`} />
            ) : null}
          </div>

          {unpublishedDraftWarning ? (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <p>
                An unpublished draft already exists ahead of the published pointer. Publishing will replace the published
                version pointer with the current draft.
              </p>
            </div>
          ) : null}

          {diffSummary ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Change summary preview</p>
              <GrowthSharePageTemplateVersionDiff summary={diffSummary} compact />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label className="text-xs">Change summary</Label>
            <Input
              value={publishSummary}
              onChange={(event) => onPublishSummaryChange(event.target.value)}
              placeholder="What changed in this version?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={publishing}>
            Cancel
          </Button>
          <Button disabled={publishing} onClick={onConfirm}>
            {publishing ? <Loader2 className="mr-1.5 size-3.5 animate-spin" /> : null}
            Publish to library
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
