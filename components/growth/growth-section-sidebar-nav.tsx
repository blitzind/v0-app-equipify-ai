"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  BookOpen,
  Bot,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Flame,
  Gauge,
  GitBranch,
  Headphones,
  Inbox,
  LayoutDashboard,
  Mail,
  Map as MapIcon,
  MessageSquare,
  Network,
  Phone,
  PlayCircle,
  Plug,
  Radio,
  Radar,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Truck,
  Upload,
  Users,
  Workflow,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  GROWTH_SIDEBAR_COLLAPSED_STORAGE_KEY,
  useGrowthSidebarConsole,
  type GrowthSidebarConsoleKey,
  type GrowthSidebarPreviewLine,
} from "@/hooks/use-growth-sidebar-console"
import {
  GROWTH_NAV_GROUP_DEFS,
  GROWTH_NAVIGATION_IA_QA_MARKER,
  growthNavigationShortcutLabel,
  normalizeGrowthPathname,
  safeMatchGrowthNavItem,
  type GrowthNavItemDef,
} from "@/lib/growth/navigation/growth-navigation-destinations"
import { GROWTH_NAVIGATION_POLISH_QA_MARKER } from "@/lib/growth/navigation/growth-navigation-ranking"
import { isGrowthNavigationInputTarget } from "@/lib/growth/navigation/growth-navigation-input-guard"
import { cn } from "@/lib/utils"

export const GROWTH_SIDEBAR_NAV_QA_MARKER = "growth-sidebar-nav-v2" as const

export const GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY = "equipify-growth-sidebar-groups-collapsed"

type GrowthNavItem = GrowthNavItemDef & {
  icon: LucideIcon
}

type GrowthNavGroup = {
  id: string
  label: string
  items: GrowthNavItem[]
}

const GROWTH_NAV_ICONS: Record<string, LucideIcon> = {
  command: LayoutDashboard,
  "revenue-inbox": Inbox,
  "prospect-search": Search,
  "intent-pixel": Radar,
  "unified-inbox": Mail,
  imports: Upload,
  outreach: Send,
  "outreach-approval": Send,
  sequences: GitBranch,
  "reply-inbox": Mail,
  meetings: CalendarClock,
  "call-queue": Phone,
  "call-workspace": Headphones,
  "sequence-execution": PlayCircle,
  engagement: Activity,
  conversations: MessageSquare,
  pipeline: GitBranch,
  opportunities: Target,
  "revenue-operating": Crown,
  revenue: TrendingUp,
  executive: Crown,
  capacity: Gauge,
  calls: Phone,
  "calls-live": Radio,
  "live-coaching": Sparkles,
  "call-providers": Plug,
  "lead-intelligence": Workflow,
  "lead-engine-inspector": Workflow,
  "crm-leads": Users,
  "discover-companies": Search,
  providers: Plug,
  "provider-delivery": Truck,
  infrastructure: Server,
  "mailbox-connections": Mail,
  deliverability: ShieldCheck,
  warmup: Flame,
  copilot: Bot,
  playbooks: BookOpen,
  "ai-research": Sparkles,
  "ai-generations": Bot,
  relationships: Users,
  "market-graph": Network,
  "territory-intelligence": MapIcon,
  "company-signals": Zap,
  "growth-signals": TrendingUp,
  "committee-intelligence": Users,
  "committee-mapping": Users,
  "market-discovery": Search,
  territories: MapIcon,
  "human-execution": Headphones,
  "growth-settings": Settings,
  "communication-settings": Settings,
  "provider-settings": Plug,
}

function toNavItems(defs: GrowthNavItemDef[]): GrowthNavItem[] {
  return defs.map((item) => ({
    ...item,
    icon: GROWTH_NAV_ICONS[item.id] ?? LayoutDashboard,
  }))
}

const GROWTH_NAV_GROUPS: GrowthNavGroup[] = GROWTH_NAV_GROUP_DEFS.map((group) => ({
  id: group.id,
  label: group.label,
  items: toNavItems(group.items),
}))

function resolveNavBadge(
  item: GrowthNavItem,
  badges: Partial<Record<GrowthSidebarConsoleKey, number>> | null | undefined,
): number | undefined {
  try {
    if (item.futurePlaceholder) return undefined
    const safeBadges = badges ?? {}
    if (item.id === "calls") {
      const total = (safeBadges.calls ?? 0) + (safeBadges.callQueue ?? 0)
      return total > 0 ? total : undefined
    }
    if (!item.consoleKey) return undefined
    const count = safeBadges[item.consoleKey]
    return count && count > 0 ? count : undefined
  } catch {
    if (process.env.NODE_ENV === "development") {
      console.warn("[GrowthSidebar] GrowthBadgeResolution failed", { id: item.id })
    }
    return undefined
  }
}

function groupHasActiveRoute(group: GrowthNavGroup, pathname: string): boolean {
  return group.items.some((item) => safeMatchGrowthNavItem(item, pathname))
}

function readCollapsedGrowthGroups(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const raw = window.localStorage.getItem(GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return new Set(parsed.filter((x): x is string => typeof x === "string"))
    return new Set()
  } catch {
    return new Set()
  }
}

function writeCollapsedGrowthGroups(set: Set<string>) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(GROWTH_SIDEBAR_GROUPS_COLLAPSED_STORAGE_KEY, JSON.stringify(Array.from(set)))
  } catch {
    // localStorage may be unavailable; collapse state stays in memory.
  }
}

function resolvePreviewLines(
  item: GrowthNavItem,
  previews: Partial<Record<GrowthSidebarConsoleKey, GrowthSidebarPreviewLine[]>> | null | undefined,
): GrowthSidebarPreviewLine[] | undefined {
  if (item.futurePlaceholder || !item.consoleKey) return undefined
  return previews?.[item.consoleKey]
}

function useGrowthSidebarGroupCollapse(pathname: string, groups: GrowthNavGroup[]) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setCollapsedGroups(readCollapsedGrowthGroups())
  }, [])

  useEffect(() => {
    setCollapsedGroups((prev) => {
      let mutated = false
      const next = new Set(prev)
      for (const group of groups) {
        if (!next.has(group.id)) continue
        if (groupHasActiveRoute(group, pathname)) {
          next.delete(group.id)
          mutated = true
        }
      }
      if (mutated) writeCollapsedGrowthGroups(next)
      return mutated ? next : prev
    })
  }, [pathname, groups])

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      writeCollapsedGrowthGroups(next)
      return next
    })
  }, [])

  return { collapsedGroups, toggleGroup }
}

const GROWTH_NAV_ROW_MOTION = "rounded-lg text-sm transition-all duration-150"

const GROWTH_NAV_ROW_INACTIVE =
  "border border-transparent text-muted-foreground hover:border-border/60 hover:bg-muted/40 hover:text-foreground dark:hover:bg-blue-500/[0.08] dark:hover:text-foreground"

const GROWTH_NAV_ROW_ACTIVE =
  "border border-blue-200/70 bg-blue-50/90 font-medium text-foreground dark:border-cyan-500/25 dark:bg-slate-800/90 dark:text-white"

const GROWTH_NAV_ICON_INACTIVE =
  "text-muted-foreground/70 group-hover:text-foreground dark:text-muted-foreground/55 dark:group-hover:text-foreground/90"

const GROWTH_NAV_ICON_ACTIVE = "text-blue-600 dark:text-cyan-300"

const GROWTH_NAV_ACTIVE_RAIL = "bg-cyan-500 dark:bg-cyan-400"

function NavBadge({ count, active }: { count?: number; active?: boolean }) {
  if (!count || count <= 0) return null
  return (
    <span
      className={cn(
        "ml-2 inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
        active
          ? "bg-blue-100 text-blue-800 dark:bg-cyan-500/20 dark:text-cyan-100"
          : "bg-emerald-100 text-emerald-800 dark:bg-slate-700 dark:text-slate-200",
      )}
    >
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
  const active = safeMatchGrowthNavItem(item, pathname)
  const Icon = item.icon
  const placeholder = item.futurePlaceholder

  const rowClassName = cn(
    "group relative flex min-w-0 items-center gap-2",
    GROWTH_NAV_ROW_MOTION,
    compact ? "shrink-0 px-3 py-2" : "px-3 py-2",
    collapsed && !compact ? "justify-center px-2" : "",
    placeholder ? "cursor-not-allowed opacity-60" : "",
    active ? GROWTH_NAV_ROW_ACTIVE : GROWTH_NAV_ROW_INACTIVE,
  )

  const rowContent = (
    <>
      {active && !collapsed && !compact ? (
        <span
          className={cn("absolute left-0 top-1/2 z-[1] h-5 w-0.5 -translate-y-1/2 rounded-r-full", GROWTH_NAV_ACTIVE_RAIL)}
          aria-hidden
        />
      ) : null}
      {active && collapsed && !compact ? (
        <span
          className={cn("absolute bottom-1 left-1/2 z-[1] h-1.5 w-1.5 -translate-x-1/2 rounded-full", GROWTH_NAV_ACTIVE_RAIL)}
          aria-hidden
        />
      ) : null}
      <Icon className={cn("size-4 shrink-0", active ? GROWTH_NAV_ICON_ACTIVE : GROWTH_NAV_ICON_INACTIVE)} aria-hidden />
      {collapsed && !compact && badge ? (
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-semibold tabular-nums",
            active
              ? "bg-blue-100 text-blue-800 dark:bg-cyan-500/20 dark:text-cyan-100"
              : "bg-emerald-100 text-emerald-800 dark:bg-slate-700 dark:text-slate-200",
          )}
          aria-label={`${badge} notifications`}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null}
      {!collapsed || compact ? (
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      ) : null}
      {!collapsed && !compact ? <NavBadge count={badge} active={active} /> : null}
      {compact && badge ? (
        <NavBadge count={badge} active={active} />
      ) : null}
    </>
  )

  if (placeholder) {
    return (
      <span className={rowClassName} aria-disabled="true" title="Coming soon">
        {rowContent}
      </span>
    )
  }

  const link = (
    <Link href={item.href} className={rowClassName}>
      {rowContent}
    </Link>
  )

  if (collapsed && !compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="max-w-48 bg-card text-foreground border shadow-md">
          <PreviewTooltipContent
            label={item.label}
            lines={
              badge
                ? [{ label: "Count", value: badge > 99 ? "99+" : String(badge) }, ...(previewLines ?? [])]
                : previewLines
            }
          />
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
  collapsedGroups,
  toggleGroup,
  groups = GROWTH_NAV_GROUPS,
}: {
  pathname: string
  collapsed?: boolean
  compact?: boolean
  badges: Partial<Record<GrowthSidebarConsoleKey, number>>
  previews: Partial<Record<GrowthSidebarConsoleKey, GrowthSidebarPreviewLine[]>>
  collapsedGroups?: Set<string>
  toggleGroup?: (groupId: string) => void
  groups?: GrowthNavGroup[]
}) {
  return (
    <>
      {groups.map((group, groupIndex) => {
        const groupCollapsed = collapsedGroups?.has(group.id) ?? false
        const groupActive = groupHasActiveRoute(group, pathname)
        const showHeader = !compact && !collapsed && toggleGroup
        const hideItems = showHeader && groupCollapsed

        return (
          <div
            key={group.id}
            className={cn(
              compact ? "min-w-0 shrink-0" : "min-w-0",
              !compact && groupIndex > 0 ? "mt-4 border-t border-border/50 pt-3 dark:border-border/40" : "",
              !compact && groupIndex === 0 ? "mt-0" : "",
            )}
          >
            {showHeader ? (
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={!groupCollapsed}
                aria-controls={`growth-nav-group-${group.id}`}
                className={cn(
                  "mb-1.5 flex w-full items-center justify-between gap-2 rounded-md px-3 py-1",
                  "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                  "select-none transition-colors hover:text-foreground dark:hover:text-foreground/90",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate">{group.label}</span>
                  {groupCollapsed && groupActive ? (
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", GROWTH_NAV_ACTIVE_RAIL)} aria-hidden />
                  ) : null}
                </span>
                <ChevronDown
                  className={cn("size-3.5 shrink-0 transition-transform duration-150", groupCollapsed && "-rotate-90")}
                  aria-hidden
                />
              </button>
            ) : null}
            {!showHeader && !compact && !collapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
            ) : null}
            <div
              id={`growth-nav-group-${group.id}`}
              hidden={hideItems}
              className={cn(compact ? "space-y-0.5" : "space-y-0.5 pb-0.5")}
            >
              {group.items.map((item) => (
                <GrowthNavLink
                  key={item.id}
                  item={item}
                  pathname={pathname}
                  collapsed={collapsed}
                  compact={compact}
                  badge={resolveNavBadge(item, badges)}
                  previewLines={resolvePreviewLines(item, previews)}
                />
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

function GrowthSidebarHealthStrip({
  collapsed,
  health,
  loading,
  degraded,
}: {
  collapsed: boolean
  health: {
    openInbox?: number
    pendingApproval?: number
    activeSequences?: number
    criticalSignals?: number
    systemHealthLabel?: string
  } | null
  loading: boolean
  degraded?: boolean
}) {
  const safeHealth = {
    openInbox: health?.openInbox ?? 0,
    pendingApproval: health?.pendingApproval ?? 0,
    activeSequences: health?.activeSequences ?? 0,
    criticalSignals: health?.criticalSignals ?? 0,
    systemHealthLabel: health?.systemHealthLabel ?? "Healthy",
  }
  const systemTone =
    safeHealth.systemHealthLabel === "Healthy"
      ? "text-emerald-700"
      : safeHealth.systemHealthLabel === "Monitor"
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
          <p className="text-[11px]">Open inbox: {loading ? "…" : safeHealth.openInbox}</p>
          <p className="text-[11px]">Pending approval: {loading ? "…" : safeHealth.pendingApproval}</p>
          <p className="text-[11px]">Active sequences: {loading ? "…" : safeHealth.activeSequences}</p>
          <p className="text-[11px]">Critical signals: {loading ? "…" : safeHealth.criticalSignals}</p>
          <p className={cn("text-[11px] font-medium", systemTone)}>
            System: {loading ? "…" : degraded ? "Degraded" : safeHealth.systemHealthLabel}
          </p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Growth Health</p>
      <dl className="mt-2 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Open Inbox</dt>
          <dd className="font-semibold tabular-nums">{loading ? "…" : safeHealth.openInbox}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Pending Approval</dt>
          <dd className="font-semibold tabular-nums">{loading ? "…" : safeHealth.pendingApproval}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Active Sequences</dt>
          <dd className="font-semibold tabular-nums">{loading ? "…" : safeHealth.activeSequences}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">Critical Signals</dt>
          <dd className="font-semibold tabular-nums">{loading ? "…" : safeHealth.criticalSignals}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-muted-foreground">System Health</dt>
          <dd className={cn("font-semibold", systemTone)}>{loading ? "…" : degraded ? "Degraded" : safeHealth.systemHealthLabel}</dd>
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
      if (isGrowthNavigationInputTarget(event.target)) return

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
  return (
    <GrowthSidebarNavErrorBoundary>
      <GrowthSectionSidebarNavInner />
    </GrowthSidebarNavErrorBoundary>
  )
}

class GrowthSidebarNavErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[GrowthSidebar] GrowthSidebarNav render failed")
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <nav aria-label="Growth Engine" className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-6 rounded-2xl border border-border bg-card p-3 text-xs text-muted-foreground shadow-sm">
            Growth navigation unavailable. Refresh to retry.
          </div>
        </nav>
      )
    }
    return this.props.children
  }
}

function GrowthSectionSidebarNavInner() {
  const pathname = normalizeGrowthPathname(usePathname())
  const consoleState = useGrowthSidebarConsole()
  const [collapsed, setCollapsed] = useState(false)
  const { collapsedGroups, toggleGroup } = useGrowthSidebarGroupCollapse(pathname, GROWTH_NAV_GROUPS)

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
        data-qa-marker={GROWTH_SIDEBAR_NAV_QA_MARKER}
        data-navigation-ia-marker={GROWTH_NAVIGATION_IA_QA_MARKER}
        data-navigation-polish-marker={GROWTH_NAVIGATION_POLISH_QA_MARKER}
        className={cn("hidden shrink-0 lg:block", collapsed ? "w-[4.5rem]" : "w-60")}
      >
        <div className="sticky top-6 flex flex-col rounded-2xl border border-border bg-card p-3 shadow-sm dark:border-border/80 dark:bg-card/95">
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

          {collapsed ? (
            <>
              {GROWTH_NAV_GROUPS.map((group, groupIndex) => (
                <div key={group.id} className={cn("space-y-0.5", groupIndex > 0 ? "mt-3 border-t border-border/50 pt-3 dark:border-border/40" : "")}>
                  {group.items.map((item) => (
                    <GrowthNavLink
                      key={item.id}
                      item={item}
                      pathname={pathname}
                      collapsed
                      badge={resolveNavBadge(item, consoleState.badges)}
                      previewLines={resolvePreviewLines(item, consoleState.previews)}
                    />
                  ))}
                </div>
              ))}
            </>
          ) : (
            <GrowthNavGroups
              pathname={pathname}
              collapsed={collapsed}
              badges={consoleState.badges}
              previews={consoleState.previews}
              collapsedGroups={collapsedGroups}
              toggleGroup={toggleGroup}
            />
          )}

          <GrowthSidebarHealthStrip
            collapsed={collapsed}
            health={consoleState.health}
            loading={consoleState.loading}
            degraded={consoleState.degraded}
          />

          {!collapsed ? (
            <p className="mt-3 px-2 text-[10px] text-muted-foreground">
              {growthNavigationShortcutLabel()} navigation · g then i/c/r/e/m
            </p>
          ) : null}
        </div>
      </nav>

      <nav
        aria-label="Growth Engine"
        data-qa-marker={GROWTH_SIDEBAR_NAV_QA_MARKER}
        data-navigation-ia-marker={GROWTH_NAVIGATION_IA_QA_MARKER}
        data-navigation-polish-marker={GROWTH_NAVIGATION_POLISH_QA_MARKER}
        className="lg:hidden"
      >
        <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-card p-2 shadow-sm dark:border-border/80 dark:bg-card/95">
          <GrowthNavGroups
            pathname={pathname}
            badges={consoleState.badges}
            previews={consoleState.previews}
            collapsedGroups={collapsedGroups}
            toggleGroup={toggleGroup}
          />
        </div>
      </nav>
    </TooltipProvider>
  )
}
