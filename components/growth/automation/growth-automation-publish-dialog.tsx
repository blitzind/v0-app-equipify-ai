"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS } from "@/lib/growth/automation/growth-automation-publish-types"
import type { GrowthAutomationPublishReadinessResult } from "@/lib/growth/automation/growth-automation-publish-types"

type Props = {
  readiness: GrowthAutomationPublishReadinessResult | null
  loading?: boolean
  onConfirm?: () => void
}

export function GrowthAutomationPublishDialog({ readiness, loading, onConfirm }: Props) {
  const blocked = !readiness?.ok

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={loading || blocked}>
          Publish metadata
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Publish automation flow version?</AlertDialogTitle>
          <AlertDialogDescription>
            S5-F stores compile/simulation metadata and marks the version published. No SR-3 runtime
            artifacts are written and automation execution remains disabled.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-2 text-xs text-muted-foreground">
          {GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.publish_metadata_only ? <p>Publish metadata only</p> : null}
          {GROWTH_AUTOMATION_PUBLISH_SAFETY_FLAGS.runtime_publish_enabled === false ? (
            <p>Runtime publish disabled</p>
          ) : null}
          {readiness?.requiresHumanReview ? <p>Human review required for action nodes</p> : null}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={blocked || loading} onClick={onConfirm}>
            Confirm publish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
