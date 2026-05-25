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

const QUICK_ACTIONS = [
  { href: "/admin/growth/imports", label: "Import Leads", icon: FileUp },
  { href: "/admin/growth/leads?focus=research", label: "Run Research", icon: Sparkles },
  { href: "/admin/growth/leads?focus=ai-copilot", label: "Generate Copilot Draft", icon: Sparkles },
  { href: "/admin/growth/calls/live-coaching", label: "Start Live Call", icon: Headphones },
  { href: "/admin/growth/meetings", label: "Join Meeting", icon: Video },
  { href: "/admin/growth/sequences", label: "Open Sequences", icon: GitBranch },
  { href: "/admin/growth/outreach/approval", label: "Open Approval Queue", icon: CheckCircle2 },
] as const

export function GrowthCommandQuickActionsRail() {
  return (
    <GrowthEngineCard title="Quick Actions" icon={<Zap className="size-4" />} className="lg:sticky lg:top-4">
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <li key={action.href}>
              <Link
                href={action.href}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:border-indigo-200 hover:bg-indigo-50/40"
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
