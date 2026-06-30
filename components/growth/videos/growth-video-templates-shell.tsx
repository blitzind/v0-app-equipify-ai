"use client"

import Link from "next/link"
import { Clapperboard, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import {
  GROWTH_VIDEOS_FIRST_RUN_RECORD_CTA,
  GROWTH_VIDEOS_FIRST_RUN_UPLOAD_CTA,
  GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-operator-simplification-1e"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { usePathname } from "next/navigation"

export function GrowthVideoTemplatesShell() {
  const pathname = usePathname()

  return (
    <GrowthVideoWorkspaceShell
      title="Video Templates"
      description="Reusable layouts for personalized video pages and recording defaults."
    >
      <div
        className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center"
        data-qa-marker={GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER}
      >
        <Clapperboard className="mx-auto mb-3 size-8 text-violet-600" />
        <h2 className="text-base font-semibold">No video templates yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Upload or record a video first, then save layouts here to reuse across outreach.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button size="sm" asChild>
            <Link href={growthFeaturePath(pathname, "videos/library")}>
              <Upload className="mr-2 size-4" />
              {GROWTH_VIDEOS_FIRST_RUN_UPLOAD_CTA}
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href={growthFeaturePath(pathname, "videos/record")}>{GROWTH_VIDEOS_FIRST_RUN_RECORD_CTA}</Link>
          </Button>
        </div>
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
