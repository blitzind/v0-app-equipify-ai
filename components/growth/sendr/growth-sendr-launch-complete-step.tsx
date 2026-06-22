"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  GROWTH_PERSONALIZED_VIDEOS_PRODUCT_LABEL,
  GROWTH_PERSONALIZED_VIDEOS_WORKSPACE_PATH,
} from "@/lib/growth/sendr/growth-sendr-branding"
import type { GrowthSendrLaunchRunProgress } from "@/lib/growth/sendr/growth-sendr-types"

type Props = {
  progress: GrowthSendrLaunchRunProgress
  onStartOver: () => void
}

const POST_LAUNCH_STEPS = [
  { title: "Review pending approvals", href: "/growth/campaigns/sequences" },
  { title: "Approve sends", href: "/growth/campaigns/sequences" },
  { title: "Monitor engagement", href: "/growth/engagement" },
  { title: "Track meetings", href: "/growth/meetings" },
  { title: "Follow runbook", href: "/growth/runbook" },
] as const

export function GrowthSendrLaunchCompleteStep({ progress, onStartOver }: Props) {
  const failed = progress.status === "failed"
  const cancelled = progress.status === "cancelled"
  const succeeded = !failed && !cancelled

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
              : "Enrollment finished. Sequence steps were not auto-sent — approve sends before delivery."}
        </p>
      </div>

      {succeeded ? (
        <>
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

          <div className="rounded-md border bg-muted/20 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recommended next steps</p>
            <ol className="mt-2 space-y-2">
              {POST_LAUNCH_STEPS.map((step, index) => (
                <li key={step.title} className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-semibold text-emerald-800">
                      {index + 1}
                    </span>
                    {step.title}
                  </span>
                  <Link href={step.href} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Open
                    <ArrowRight className="size-3" />
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {succeeded ? (
          <>
            <Button size="sm" variant="default" asChild>
              <Link href="/growth/campaigns/sequences">
                <CheckCircle2 className="mr-1 size-3.5" />
                Pending approvals
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/growth/engagement">Engagement</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/growth/meetings">Meetings</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link href="/growth/runbook">Launch runbook</Link>
            </Button>
          </>
        ) : null}
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
