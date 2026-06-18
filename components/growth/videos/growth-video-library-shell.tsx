"use client"

import { Search, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GrowthEngineHonestEmptyState } from "@/components/growth/growth-engine-honest-empty-state"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"

export function GrowthVideoLibraryShell() {
  return (
    <GrowthVideoWorkspaceShell
      title="Video Library"
      description="Browse recorded and uploaded assets. Search, filters, and uploads arrive in a later phase."
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search videos (placeholder)" disabled />
        </div>
        <Button variant="outline" size="sm" disabled>
          <Upload className="mr-1 h-4 w-4" />
          Upload video
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {["All", "Draft", "Ready", "Archived"].map((label) => (
          <Button key={label} size="sm" variant="outline" disabled className="rounded-full">
            {label}
          </Button>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8">
        <GrowthEngineHonestEmptyState
          kind="no_data"
          title="No videos yet"
          message="Record or upload a video to populate your library. Foundation shell only — capture arrives in a later phase."
        />
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
