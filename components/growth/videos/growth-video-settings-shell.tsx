"use client"

import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"

const SETTINGS_SECTIONS = [
  {
    id: "storage",
    title: "Storage",
    description: "Provider-agnostic storage targets (Supabase, S3, R2) — configuration placeholder.",
  },
  {
    id: "branding",
    title: "Branding",
    description: "Logo, colors, and player chrome for personalized video pages.",
  },
  {
    id: "permissions",
    title: "Permissions",
    description: "Who can record, publish, and manage video assets.",
  },
  {
    id: "recording-defaults",
    title: "Recording Defaults",
    description: "Default capture mode, quality, and upload behavior.",
  },
] as const

export function GrowthVideoSettingsShell() {
  return (
    <GrowthVideoWorkspaceShell
      title="Video Settings"
      description="Workspace configuration placeholders for the recording studio."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {SETTINGS_SECTIONS.map((section) => (
          <div key={section.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <p className="text-sm font-semibold">{section.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
          </div>
        ))}
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
