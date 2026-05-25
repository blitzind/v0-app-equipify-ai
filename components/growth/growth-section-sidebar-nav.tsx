"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BookOpen,
  Bot,
  ChevronLeft,
  ChevronRight,
  Crown,
  Gauge,
  GitBranch,
  Inbox,
  LayoutDashboard,
  Mail,
  MessageSquare,
  Phone,
  PlayCircle,
  Plug,
  Plus,
  Radio,
  Send,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Upload,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  GROWTH_SIDEBAR_COLLAPSED_STORAGE_KEY,
  useGrowthSidebarConsole,
  type GrowthSidebarConsoleKey,
  type GrowthSidebarPreviewLine,
} from "@/hooks/use-growth-sidebar-console"
import { cn } from "@/lib/utils"

type GrowthNavItem = {
  href: string
  label: string
  icon: LucideIcon
  match: (path: string) => boolean
  consoleKey?: GrowthSidebarConsoleKey
  shortcutKey?: string
}

type GrowthNavGroup = {
  label: string
  items: GrowthNavItem[]
}

const GROWTH_NAV_GROUPS: GrowthNavGroup[] = [
  {
    label: "Core",
    items: [
      {
        href: "/admin/growth/command",
        label: "Command Center",
        icon: LayoutDashboard,
        match: (path) => path.startsWith("/admin/growth/command"),
        consoleKey: "command",
        shortcutKey: "m",
      },
      {
        href: "/admin/growth/leads",
        label: "Inbox",
        icon: Inbox,
        match: (path) => path === "/admin/growth/leads",
        consoleKey: "inbox",
        shortcutKey: "i",
      },
      {
        href: "/admin/growth/replies",
        label: "Reply Inbox",
        icon: Mail,
        match: (path) => path.startsWith("/admin/growth/replies"),
      },
      {
        href: "/admin/growth/leads/queue",
        label: "Call Queue",
        icon: Phone,
        match: (path) => path.startsWith("/admin/growth/leads/queue"),
        consoleKey: "callQueue",
        shortcutKey: "c",
      },
      {
        href: "/admin/growth/imports",
        label: "Imports",
        icon: Upload,
        match: (path) => path.startsWith("/admin/growth/imports"),
        consoleKey: "imports",
      },
    ],
  },
  {
    label: "Intelligence",
    items: [
      {
        href: "/admin/growth/engagement",
        label: "Engagement",
        icon: Activity,
        match: (path) => path.startsWith("/admin/growth/engagement"),
        consoleKey: "engagement",
      },
      {
        href: "/admin/growth/conversations",
        label: "Conversations",
        icon: MessageSquare,
        match: (path) => path.startsWith("/admin/growth/conversations"),
        consoleKey: "conversations",
      },
      {
        href: "/admin/growth/sequences",
        label: "Sequences",
        icon: GitBranch,
        match: (path) => path === "/admin/growth/sequences",
        consoleKey: "sequences",
      },
      {
        href: "/admin/growth/sequences/execution",
        label: "Sequence Execution",
        icon: PlayCircle,
        match: (path) => path.startsWith("/admin/growth/sequences/execution"),
        consoleKey: "sequence_execution",
      },
      {
        href: "/admin/growth/relationships",
        label: "Relationships",
        icon: Users,
        match: (path) => path.startsWith("/admin/growth/relationships"),
        consoleKey: "relationships",
      },
      {
        href: "/admin/growth/opportunities/pipeline",
        label: "Pipeline",
        icon: GitBranch,
        match: (path) => path.startsWith("/admin/growth/opportunities/pipeline"),
        consoleKey: "opportunities",
      },
      {
        href: "/admin/growth/opportunities",
        label: "Opportunities",
        icon: Target,
        match: (path) => path === "/admin/growth/opportunities",
        consoleKey: "opportunities",
      },
      {
        href: "/admin/growth/revenue-operating",
        label: "Revenue Operating",
        icon: Crown,
        match: (path) => path.startsWith("/admin/growth/revenue-operating"),
        consoleKey: "revenue",
      },
      {
        href: "/admin/growth/revenue",
        label: "Revenue",
        icon: TrendingUp,
        match: (path) => path === "/admin/growth/revenue",
        consoleKey: "revenue",
        shortcutKey: "r",
      },
      {
        href: "/admin/growth/executive",
        label: "Executive",
        icon: Crown,
        match: (path) => path.startsWith("/admin/growth/executive"),
        consoleKey: "executive",
        shortcutKey: "e",
      },
      {
        href: "/admin/growth/capacity",
        label: "Capacity",
        icon: Gauge,
        match: (path) => path.startsWith("/admin/growth/capacity"),
        consoleKey: "capacity",
      },
    ],
  },
  {
    label: "AI & Channels",
    items: [
      {
        href: "/admin/growth/copilot",
        label: "Copilot",
        icon: Bot,
        match: (path) => path === "/admin/growth/copilot",
        consoleKey: "copilot",
      },
      {
        href: "/admin/growth/copilot/playbooks",
        label: "Playbook Training",
        icon: BookOpen,
        match: (path) => path.startsWith("/admin/growth/copilot/playbooks"),
        consoleKey: "playbooks",
      },
      {
        href: "/admin/growth/calls",
        label: "Calls",
        icon: Phone,
        match: (path) => path === "/admin/growth/calls",
        consoleKey: "calls",
      },
      {
        href: "/admin/growth/calls/providers",
        label: "Call Providers",
        icon: Plug,
        match: (path) => path.startsWith("/admin/growth/calls/providers"),
        consoleKey: "calls_providers",
      },
      {
        href: "/admin/growth/calls/live",
        label: "Live Calls",
        icon: Radio,
        match: (path) =>
          path.startsWith("/admin/growth/calls/live") && !path.startsWith("/admin/growth/calls/live-coaching"),
        consoleKey: "calls_live",
      },
      {
        href: "/admin/growth/calls/live-coaching",
        label: "Live Coaching",
        icon: Sparkles,
        match: (path) => path.startsWith("/admin/growth/calls/live-coaching"),
        consoleKey: "calls_live_coaching",
      },
      {
        href: "/admin/growth/outreach",
        label: "Outreach",
        icon: Mail,
        match: (path) => path === "/admin/growth/outreach",
        consoleKey: "outreach",
      },
      {
        href: "/admin/growth/outreach/approval",
        label: "Outreach Approval",
        icon: Send,
        match: (path) => path.startsWith("/admin/growth/outreach/approval"),
        consoleKey: "outreach_approval",
      },
      {
        href: "/admin/growth/providers",
        label: "Providers",
        icon: Plug,
        match: (path) => path.startsWith("/admin/growth/providers"),
        consoleKey: "providers",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      {
        href: "/admin/growth/settings",
        label: "Settings",
        icon: Settings,
        match: (path) => path.startsWith("/admin/growth/settings"),
      },
    ],
  },
]

const QUICK_ACTIONS = [
  { href: "/admin/growth/imports", label: "Import Leads" },
  { href: "/admin/growth/leads", label: "Run Research" },
  { href: "/admin/growth/copilot", label: "Generate Copilot Draft" },
] as const

function NavBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-emerald-800">
      {count > 99 ? "99+" : count}
    </span>
  )
}

function PreviewTooltipContent({
  label,
  lines,
}: {
  label: string
  lines?: GrowthSidebarPreviewLine[]
}) {
  if (!lines?.length) return <span>{label}</span>
  return (
    <div className="space-y-1.5">
      <p className="font-medium">{label}</p>
      {lines.map((line) => (
        <div key={line.label} className="flex items-center justify-between gap-4 text-[11px] opacity-90">
          <span>{line.label}</span>
          <span className="font-semibold tabular-nums">{line.value}</span>
        </div>
      ))}
    </div>
  )
}

function GrowthNavLink({
  item,
  pathname,
  collapsed,
  compact,
  badge,
  previewLines,
}: {
  item: GrowthNavItem
  pathname: string
  collapsed?: boolean
  compact?: boolean
  badge?: number
  previewLines?: GrowthSidebarPreviewLine[]
}) {
  const active = item.match(pathname)
  const Icon = item.icon

  const link = (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-lg border text-sm font-medium transition-colors",
        compact ? "shrink-0 px-3 py-2" : "px-3 py-2",
        collapsed && !compact ? "justify-center px-2" : "",
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-transparent text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!collapsed || compact ? <span className="truncate">{item.label}</span> : null}
      {!collapsed && !compact ? <NavBadge count={badge} /> : null}
      {compact && badge ? (
        <span className="rounded-full bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-800">{badge}</span>
      ) : null}
    </Link>
  )

  if (collapsed && !compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="max-w-48 bg-card text-foreground border shadow-md">
          <PreviewTooltipContent label={item.label} lines={previewLines} />
        </TooltipContent>
      </Tooltip>
    )
  }

  if (previewLines?.length && !compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="max-w-48 bg-card text-foreground border shadow-md">
          <PreviewTooltipContent label={item.label} lines={previewLines} />
        </TooltipContent>
      </Tooltip>
    )
  }

  return link
}

function GrowthNavGroups({
  pathname,
  collapsed,
  compact,
  badges,
  previews,
}: {
  pathname: string
  collapsed?: boolean
  compact?: boolean
  badges: Partial<Record<GrowthSidebarConsoleKey, number>>
  previews: Partial<Record<GrowthSidebarConsoleKey, GrowthSidebarPreviewLine[]>>
}) {
  return (
    <>
      {GROWTH_NAV_GROUPS.map((group) => (
        <div key={group.label} className={cn(compact ? "shrink-0" : "space-y-1")}>
          {!compact && !collapsed ? (
            <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground first:pt-0">
              {group.label}
            </p>
          ) : null}
          <div className={cn(compact ? "flex gap-2" : "space-y-0.5")}>
            {group.items.map((item) => (
              <GrowthNavLink
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed={collapsed}
                compact={compact}
                badge={item.consoleKey ? badges[item.consoleKey] : undefined}
                previewLines={item.consoleKey ? previews[item.consoleKey] : undefined}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function GrowthSidebarQuickActions({ collapsed }: { collapsed: boolean }) {
  return (
    <div className={cn("space-y-1 border-t border-border pt-3", collapsed ? "px-1" : "px-1")}>
      {!collapsed ? (
        <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Quick actions</p>
      ) : null}
      {QUICK_ACTIONS.map((action) => {
        const button = (
          <Link
            href={action.href}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground",
              collapsed ? "justify-center" : "",
            )}
          >
            <Plus className="size-3.5 shrink-0 opacity-70" aria-hidden />
            {!collapsed ? <span className="truncate">{action.label}</span> : null}
          </Link>
        )

        if (collapsed) {
          return (
            <Tooltip key={action.href}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right">{action.label}</TooltipContent>
            </Tooltip>
          )
        }

        return <div key={action.href}>{button}</div>
      })}
    </div>
  )
}

function GrowthSidebarHealthStrip({
  collapsed,
  health,
  loading,
}: {
  collapsed: boolean
  health: { revenueRisk: number; executiveNow: number; capacityLabel: string }
  loading: boolean
}) {
  const capacityTone =
    health.capacityLabel === "Healthy"
      ? "text-emerald-700"
      : health.capacityLabel === "Strained"
        ? "text-amber-700"
        : "text-rose-700"

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-3 rounded-lg border border-border bg-muted/20 px-2 py-2 text-center">
            <Gauge className="mx-auto size-4 text-muted-foreground" aria-hidden />
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-44 bg-card text-foreground border shadow-md">
          <p className="mb-1 font-medium">Growth Health</p>
          <p className="text-[11px]">Revenue risk: {loading ? "…" : health.revenueRisk}</p>
          <p className="text-[11px]">Executive now: {loading ? "…" : health.executiveNow}</p>
          <p className={cn("text-[11px] font-medium", capacityTone)}>Capacity: {loading ? "…" : health.capacityLabel}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Growth Health</p>
      <dl className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Revenue risk</dt>
          <dd className="font-semibold tabular-nums">{loading ? "…" : health.revenueRisk}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Executive now</dt>
          <dd className="font-semibold tabular-nums">{loading ? "…" : health.executiveNow}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Capacity</dt>
          <dd className={cn("font-semibold", capacityTone)}>{loading ? "…" : health.capacityLabel}</dd>
        </div>
      </dl>
    </div>
  )
}

function useGrowthSidebarKeyboardShortcuts() {
  const router = useRouter()
  const pendingRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)

  useEffect(() => {
    const shortcutMap = new Map<string, string>()
    for (const group of GROWTH_NAV_GROUPS) {
      for (const item of group.items) {
        if (item.shortcutKey) shortcutMap.set(item.shortcutKey, item.href)
      }
    }

    function clearPending() {
      pendingRef.current = false
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return

      if (event.key === "g" && !pendingRef.current) {
        pendingRef.current = true
        timeoutRef.current = window.setTimeout(clearPending, 900)
        return
      }

      if (pendingRef.current) {
        const href = shortcutMap.get(event.key)
        clearPending()
        if (href) {
          event.preventDefault()
          router.push(href)
        }
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      clearPending()
    }
  }, [router])
}

export function GrowthSectionSidebarNav() {
  const pathname = usePathname()
  const consoleState = useGrowthSidebarConsole()
  const [collapsed, setCollapsed] = useState(false)

  useGrowthSidebarKeyboardShortcuts()

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(GROWTH_SIDEBAR_COLLAPSED_STORAGE_KEY)
      if (stored === "true") setCollapsed(true)
    } catch {
      // ignore
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(GROWTH_SIDEBAR_COLLAPSED_STORAGE_KEY, String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <nav
        aria-label="Growth Engine"
        className={cn("hidden shrink-0 lg:block", collapsed ? "w-[4.5rem]" : "w-60")}
      >
        <div className="sticky top-6 flex flex-col rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className={cn("mb-2 flex items-center gap-1", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed ? (
              <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Growth Engine</p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand Growth sidebar" : "Collapse Growth sidebar"}
            >
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </Button>
          </div>

          <GrowthNavGroups
            pathname={pathname}
            collapsed={collapsed}
            badges={consoleState.badges}
            previews={consoleState.previews}
          />

          <GrowthSidebarQuickActions collapsed={collapsed} />
          <GrowthSidebarHealthStrip collapsed={collapsed} health={consoleState.health} loading={consoleState.loading} />

          {!collapsed ? (
            <p className="mt-3 px-2 text-[10px] text-muted-foreground">Shortcuts: g then i/c/r/e</p>
          ) : null}
        </div>
      </nav>

      <nav aria-label="Growth Engine" className="lg:hidden">
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <div className="flex min-w-max gap-2 rounded-xl border border-border bg-card p-2 shadow-sm">
            <GrowthNavGroups
              pathname={pathname}
              compact
              badges={consoleState.badges}
              previews={consoleState.previews}
            />
          </div>
        </div>
      </nav>
    </TooltipProvider>
  )
}
