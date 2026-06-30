"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ArrowLeft, Monitor, Video, Webcam } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import { growthFeaturePath } from "@/lib/growth/navigation/growth-workspace-base-path"
import { usePathname } from "next/navigation"
import {
  buildGrowthVideoLibraryHref,
  parseSendrVideoReturnContext,
} from "@/lib/growth/sendr/growth-sendr-video-return-flow"
import {
  GROWTH_VIDEOS_FIRST_RUN_UPLOAD_CTA,
  GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER,
} from "@/lib/growth/workspace/growth-workspace-operator-simplification-1e"

const RECORDING_MODES = [
  {
    id: "webcam",
    title: "Record Webcam",
    description: "Face-forward capture for personalized outreach.",
    icon: Webcam,
  },
  {
    id: "screen",
    title: "Record Screen",
    description: "Screen capture for demos and walkthroughs.",
    icon: Monitor,
  },
  {
    id: "screen_webcam",
    title: "Record Screen + Webcam",
    description: "Picture-in-picture screen and webcam recording.",
    icon: Video,
  },
] as const

export function GrowthVideoRecordShell() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnContext = parseSendrVideoReturnContext(searchParams)
  const libraryUploadHref = returnContext
    ? buildGrowthVideoLibraryHref(returnContext, { openUpload: true })
    : `${growthFeaturePath(pathname, "videos/library")}?upload=1`

  return (
    <div data-qa-marker={GROWTH_WORKSPACE_OPERATOR_SIMPLIFICATION_1E_QA_MARKER}>
    <GrowthVideoWorkspaceShell
      title="Recording Studio"
      description="Choose a capture mode, or upload an existing clip to your library."
    >
      {returnContext ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 p-3 text-sm">
          <p>
            After saving a recording, continue in the Video Library to attach it to your Personalized Video Page
            {returnContext.sectionId ? " section" : ""}.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={returnContext.returnTo}>
                <ArrowLeft className="mr-1 h-4 w-4" />
                Back to page
              </Link>
            </Button>
            <Button size="sm" asChild>
              <Link href={buildGrowthVideoLibraryHref(returnContext, { openUpload: true })}>
                Upload instead
              </Link>
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        {RECORDING_MODES.map((mode) => {
          const Icon = mode.icon
          return (
            <div key={mode.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="text-sm font-semibold">{mode.title}</p>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">{mode.description}</p>
              <Button size="sm" className="w-full" asChild>
                <Link href={libraryUploadHref}>{GROWTH_VIDEOS_FIRST_RUN_UPLOAD_CTA}</Link>
              </Button>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Upload Video</p>
            <p className="text-xs text-muted-foreground">Upload existing files without recording.</p>
          </div>
          <Button size="sm" variant="outline" asChild>
            <Link href={libraryUploadHref}>
              Upload video
            </Link>
          </Button>
        </div>
      </div>
    </GrowthVideoWorkspaceShell>
    </div>
  )
}
