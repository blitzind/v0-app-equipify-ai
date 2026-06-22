"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  GROWTH_PERSONALIZED_VIDEOS_PAGE_LABEL,
  GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL,
  GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH,
  buildGrowthPersonalizedVideosPageDetailPath,
} from "@/lib/growth/sendr/growth-sendr-branding"
import type { GrowthSendrLaunchRunProgress } from "@/lib/growth/sendr/growth-sendr-types"

type Props = {
  progress: GrowthSendrLaunchRunProgress
  onStartOver: () => void
}

export function GrowthSendrLaunchCompleteStep({ progress, onStartOver }: Props) {
  const failed = progress.status === "failed"
  const cancelled = progress.status === "cancelled"

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium">
          {failed ? "Launch failed" : cancelled ? "Launch cancelled" : "Launch complete"}
        </h3>
        <p className="text-sm text-muted-foreground">
          {failed
            ? progress.error ?? "Enrollment did not complete."
            : cancelled
              ? "Launch was cancelled by operator. No further chunks will run."
              : "Enrollment finished. Sequence steps were not auto-sent."}
        </p>
      </div>

      {!failed && !cancelled ? (
        <div className="space-y-2 rounded-md border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Enrolled</span>
            <span className="font-medium">{progress.enrolledCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Requested</span>
            <span className="font-medium">{progress.requestedCount}</span>
          </div>
          {progress.launchRunId ? (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Launch run</span>
              <span className="font-mono text-xs">{progress.launchRunId.slice(0, 8)}…</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="default" asChild>
          <Link href="/growth/campaigns/sequences">Review pending approvals</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/growth/campaigns/sequences">Sequence execution</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/growth/engagement">Engagement</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href="/growth/runbook">Launch runbook</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH}>{GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL} workspace</Link>
        </Button>
        <Button size="sm" onClick={onStartOver}>
          Launch another
        </Button>
      </div>
    </div>
  )
}
