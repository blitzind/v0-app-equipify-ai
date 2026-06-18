"use client"

import { Monitor, Video, Webcam } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"

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
  return (
    <GrowthVideoWorkspaceShell
      title="Recording Studio"
      description="Choose a capture mode. Recording controls are disabled until the capture pipeline ships."
    >
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
              <Button size="sm" disabled className="w-full">Start recording</Button>
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
          <Button size="sm" variant="outline" disabled>Upload video</Button>
        </div>
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
