"use client"

import type { ElementType, ReactNode } from "react"
import Link from "next/link"
import { ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthWorkspacePageHeader } from "@/components/growth/shell/growth-workspace-page-header"
import { GROWTH_COMMUNICATIONS_SETTINGS_PATH } from "@/lib/growth/navigation/growth-communications-settings-navigation"

type GrowthCommunicationsSettingsSectionProps = {
  title: string
  description: string
  icon?: ElementType
  iconClassName?: string
  adminFallbackHref?: string
  children: ReactNode
}

export function GrowthCommunicationsSettingsSection({
  title,
  description,
  icon,
  iconClassName,
  adminFallbackHref,
  children,
}: GrowthCommunicationsSettingsSectionProps) {
  return (
    <div className="space-y-6">
      <GrowthWorkspacePageHeader
        title={title}
        description={description}
        icon={icon}
        iconClassName={iconClassName}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href={GROWTH_COMMUNICATIONS_SETTINGS_PATH}>All communications</Link>
            </Button>
            {adminFallbackHref ? (
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href={adminFallbackHref}>
                  Admin fallback
                  <ExternalLink className="ml-1.5 size-3.5" />
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />
      {children}
    </div>
  )
}
