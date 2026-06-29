"use client"

import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  NAV_SIDEBAR_ACTIVE_INDICATOR,
  settingsNavIconClassName,
  settingsNavRowClassName,
} from "@/lib/settings/settings-nav-chrome"

type SettingsNavItemLinkProps = {
  href: string
  label: string
  icon: LucideIcon
  active: boolean
  className?: string
  iconClassName?: string
}

export function SettingsNavItemLink({
  href,
  label,
  icon: Icon,
  active,
  className,
  iconClassName,
}: SettingsNavItemLinkProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={settingsNavRowClassName(active, className)}
    >
      {active ? (
        <span
          aria-hidden
          className="absolute inset-y-1.5 left-0 w-1 rounded-full"
          style={{ backgroundColor: NAV_SIDEBAR_ACTIVE_INDICATOR }}
        />
      ) : null}
      <Icon className={cn(settingsNavIconClassName(active), iconClassName)} />
      <span className="truncate">{label}</span>
    </Link>
  )
}
