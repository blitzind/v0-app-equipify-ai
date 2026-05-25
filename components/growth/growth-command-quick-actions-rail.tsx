"use client"

import Link from "next/link"
import {
  CheckCircle2,
  FileUp,
  GitBranch,
  Headphones,
  Sparkles,
  Video,
  Zap,
} from "lucide-react"
import { GrowthEngineCard } from "@/components/growth/growth-ui-utils"
import { cn } from "@/lib/utils"

const QUICK_ACTIONS = [
  { href: "/admin/growth/imports", label: "Import Leads", icon: FileUp },
  { href: "/admin/growth/leads?focus=research", label: "Run Research", icon: Sparkles },
  { href: "/admin/growth/leads?focus=ai-copilot", label: "Generate Copilot Draft", icon: Sparkles },
  { href: "/admin/growth/calls/live-coaching", label: "Start Live Call", icon: Headphones },
  { href: "/admin/growth/meetings", label: "Join Meeting", icon: Video },
  { href: "/admin/growth/sequences", label: "Open Sequences", icon: GitBranch },
  { href: "/admin/growth/outreach/approval", label: "Open Approval Queue", icon: CheckCircle2 },
] as const

type GrowthCommandQuickActionsRailProps = {
  variant?: "rail" | "chips"
}

export function GrowthCommandQuickActionsRail({ variant = "rail" }: GrowthCommandQuickActionsRailProps) {
  if (variant === "chips") {
    return (
      <div className="xl:hidden">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick actions</p>
        <div className="flex gap-3 overflow-x-auto pb-1">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(
                "shrink-0 rounded-full border border-border/80 bg-background px-4 py-2 text-sm",
                "hover:border-indigo-200 hover:bg-indigo-50/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-950/30",
              )}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <GrowthEngineCard title="Quick Actions" icon={<Zap className="size-4" />} className="sticky top-4 p-5 shadow-sm sm:p-6 [&>div:first-child]:mb-5">
      <ul className="grid gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <li key={action.href}>
              <Link
                href={action.href}
                className="flex min-h-11 items-center gap-3 rounded-xl border border-border/80 px-4 py-3 text-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50/40 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-950/30"
              >
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                {action.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </GrowthEngineCard>
  )
}
