"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthVideoWorkspaceShell } from "@/components/growth/videos/growth-video-workspace-shell"
import type { GrowthVideoSettingsSection } from "@/lib/growth/videos/growth-video-settings-types"

export function resolveGrowthVideoSettingsBasePath(pathname: string): string {
  if (pathname.startsWith("/admin/growth/videos/settings")) {
    return "/admin/growth/videos/settings"
  }
  return "/growth/videos/settings"
}

export function GrowthVideoSettingsSectionLayout({
  title,
  description,
  section,
  children,
}: {
  title: string
  description: string
  section: GrowthVideoSettingsSection
  children: ReactNode
}) {
  const pathname = usePathname()
  const basePath = resolveGrowthVideoSettingsBasePath(pathname)

  return (
    <GrowthVideoWorkspaceShell title={title} description={description}>
      <div className="space-y-4" data-growth-video-settings-section={section}>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link href={basePath}>
            <ArrowLeft className="mr-1 size-3.5" />
            Back to Video Settings
          </Link>
        </Button>
        <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground dark:border-[#25324C]">
          Human-supervised workspace — saved defaults apply to future video pages and recording flows only. No
          autonomous outreach or enrollment.
        </p>
        {children}
      </div>
    </GrowthVideoWorkspaceShell>
  )
}
