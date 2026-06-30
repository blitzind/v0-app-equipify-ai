"use client"

import Link from "next/link"
import { Clapperboard, FileText, Sparkles, Upload, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import {
  GROWTH_VIDEOS_FIRST_RUN_DESCRIPTION,
  GROWTH_VIDEOS_FIRST_RUN_PERSONALIZE_CTA,
  GROWTH_VIDEOS_FIRST_RUN_RECORD_CTA,
  GROWTH_VIDEOS_FIRST_RUN_SHARE_PAGES_CTA,
  GROWTH_VIDEOS_FIRST_RUN_TITLE,
  GROWTH_VIDEOS_FIRST_RUN_UPLOAD_CTA,
  GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-operator-simplification-1e"

type Props = {
  pathname: string
  onUpload: () => void
}

export function GrowthVideoLibraryFirstRun({ pathname, onUpload }: Props) {
  const base = growthFeaturePath(pathname, "")

  return (
    <div
      className="rounded-xl border border-dashed border-violet-200 bg-violet-50/30 p-8 dark:border-violet-900/40 dark:bg-violet-950/20"
      data-qa-marker={GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER}
    >
      <div className="mx-auto max-w-lg text-center">
        <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300">
          <Video className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">{GROWTH_VIDEOS_FIRST_RUN_TITLE}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{GROWTH_VIDEOS_FIRST_RUN_DESCRIPTION}</p>
      </div>

      <div className="mx-auto mt-6 grid max-w-2xl gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Clapperboard className="mx-auto mb-2 size-5 text-violet-600" />
          <p className="text-sm font-medium">{GROWTH_VIDEOS_FIRST_RUN_RECORD_CTA}</p>
          <Button size="sm" className="mt-3 w-full" asChild>
            <Link href={growthFeaturePath(pathname, "videos/record")}>{GROWTH_VIDEOS_FIRST_RUN_RECORD_CTA}</Link>
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <Sparkles className="mx-auto mb-2 size-5 text-violet-600" />
          <p className="text-sm font-medium">{GROWTH_VIDEOS_FIRST_RUN_PERSONALIZE_CTA}</p>
          <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
            <Link href={growthFeaturePath(pathname, "videos/personalized")}>
              {GROWTH_VIDEOS_FIRST_RUN_PERSONALIZE_CTA}
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <FileText className="mx-auto mb-2 size-5 text-violet-600" />
          <p className="text-sm font-medium">{GROWTH_VIDEOS_FIRST_RUN_SHARE_PAGES_CTA}</p>
          <Button size="sm" variant="outline" className="mt-3 w-full" asChild>
            <Link href={`${base}/share-pages`}>{GROWTH_VIDEOS_FIRST_RUN_SHARE_PAGES_CTA}</Link>
          </Button>
        </div>
      </div>

      <div className="mt-6 flex justify-center">
        <Button size="sm" onClick={onUpload}>
          <Upload className="mr-2 size-4" />
          {GROWTH_VIDEOS_FIRST_RUN_UPLOAD_CTA}
        </Button>
      </div>
    </div>
  )
}
