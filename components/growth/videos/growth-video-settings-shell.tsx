"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight, HardDrive, Palette, Shield, Video } from "lucide-react"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import { resolveGrowthVideoSettingsBasePath } from "@/components/growth/videos/growth-video-settings-section-layout"
import { GROWTH_VIDEO_SETTINGS_QA_MARKER } from "@/lib/growth/videos/growth-video-settings-types"
import { cn } from "@/lib/utils"

const SETTINGS_SECTIONS = [
  {
    id: "storage",
    title: "Storage",
    description: "Video and media buckets, MIME types, and upload limits.",
    href: "storage",
    icon: HardDrive,
  },
  {
    id: "branding",
    title: "Branding",
    description: "Logo, colors, CTA, calendar, and footer defaults for video pages.",
    href: "branding",
    icon: Palette,
  },
  {
    id: "permissions",
    title: "Permissions",
    description: "Platform access posture and provider execution gates.",
    href: "permissions",
    icon: Shield,
  },
  {
    id: "recording-defaults",
    title: "Recording Defaults",
    description: "Default capture mode, quality, duration, and transcript settings.",
    href: "recording",
    icon: Video,
  },
] as const

export function GrowthVideoSettingsShell() {
  const pathname = usePathname()
  const basePath = resolveGrowthVideoSettingsBasePath(pathname)

  return (
    <GrowthVideoWorkspaceShell
      title="Video Settings"
      description="Workspace configuration for the recording studio."
    >
      <div className="space-y-4" data-qa-marker={GROWTH_VIDEO_SETTINGS_QA_MARKER}>
        <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:border-[#25324C]">
          Configure storage, branding, permissions, and recording defaults for the Growth Video workspace.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {SETTINGS_SECTIONS.map((section) => (
            <Link
              key={section.id}
              href={`${basePath}/${section.href}`}
              className={cn(
                "group rounded-xl border border-border bg-card p-4 shadow-sm ring-1 ring-border/40 transition-colors",
                "hover:border-primary/30 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                "dark:ring-[#25324C]/80",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-muted-foreground">
                    <section.icon size={18} aria-hidden />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Configure
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{section.description}</p>
                  </div>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
                  aria-hidden
                />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
