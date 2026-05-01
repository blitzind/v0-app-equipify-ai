"use client"

import { useState } from "react"
import { Search, Download, Filter, User, Settings, CreditCard, Shield, Wrench, Key } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AuditEvent {
  id: string
  actor: string
  actorRole: string
  action: string
  target: string
  category: "account" | "workspace" | "billing" | "team" | "equipment" | "api"
  severity: "info" | "warning" | "critical"
  timestamp: string
  ip: string
}

const AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "ae1",
    actor: "Alex Johnson",
    actorRole: "Admin",
    action: "Updated workspace settings",
    target: "Workspace: Acme Corp",
    category: "workspace",
    severity: "info",
    timestamp: "Apr 30, 2026 at 10:14 AM",
    ip: "72.240.128.1",
  },
  {
    id: "ae2",
    actor: "Alex Johnson",
    actorRole: "Admin",
    action: "Invited team member",
    target: "sarah.lee@acmecorp.com (Tech)",
    category: "team",
    severity: "info",
    timestamp: "Apr 29, 2026 at 3:42 PM",
    ip: "72.240.128.1",
  },
  {
    id: "ae3",
    actor: "Marcus Webb",
    actorRole: "Manager",
    action: "Deleted equipment record",
    target: "EQ-241 — Compressor Unit",
    category: "equipment",
    severity: "warning",
    timestamp: "Apr 29, 2026 at 1:08 PM",
    ip: "98.114.32.7",
  },
  {
    id: "ae4",
    actor: "Alex Johnson",
    actorRole: "Admin",
    action: "Upgraded plan",
    target: "Starter → Growth (annual)",
    category: "billing",
    severity: "info",
    timestamp: "Apr 28, 2026 at 9:55 AM",
    ip: "72.240.128.1",
  },
  {
    id: "ae5",
    actor: "Alex Johnson",
    actorRole: "Admin",
    action: "Created API key",
    target: "Production integration",
    category: "api",
    severity: "warning",
    timestamp: "Apr 27, 2026 at 4:21 PM",
    ip: "72.240.128.1",
  },
  {
    id: "ae6",
    actor: "Tyler Oakes",
    actorRole: "Tech",
    action: "Attempted billing access",
    target: "Billing settings",
    category: "billing",
    severity: "critical",
    timestamp: "Apr 26, 2026 at 11:30 AM",
    ip: "104.28.5.13",
  },
  {
    id: "ae7",
    actor: "Alex Johnson",
    actorRole: "Admin",
    action: "Changed user role",
    target: "Marcus Webb: Tech → Manager",
    category: "team",
    severity: "info",
    timestamp: "Apr 25, 2026 at 2:10 PM",
    ip: "72.240.128.1",
  },
  {
    id: "ae8",
    actor: "Alex Johnson",
    actorRole: "Admin",
    action: "Revoked API key",
    target: "Old Zapier key",
    category: "api",
    severity: "warning",
    timestamp: "Apr 24, 2026 at 8:44 AM",
    ip: "72.240.128.1",
  },
]

const CATEGORY_ICONS: Record<AuditEvent["category"], React.ComponentType<{ size?: number; className?: string }>> = {
  account: User,
  workspace: Settings,
  billing: CreditCard,
  team: User,
  equipment: Wrench,
  api: Key,
}

const SEVERITY_STYLES: Record<AuditEvent["severity"], string> = {
  info:     "ds-badge-success",
  warning:  "ds-badge-warning",
  critical: "ds-badge-danger",
}

const CATEGORIES = ["All", "account", "workspace", "billing", "team", "equipment", "api"] as const
type CategoryFilter = typeof CATEGORIES[number]

export default function AuditLogPage() {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("All")
  const [severityFilter, setSeverityFilter] = useState<AuditEvent["severity"] | "All">("All")

  const filtered = AUDIT_EVENTS.filter((ev) => {
    const matchCat = categoryFilter === "All" || ev.category === categoryFilter
    const matchSev = severityFilter === "All" || ev.severity === severityFilter
    const q = search.toLowerCase()
    const matchSearch = !q || ev.actor.toLowerCase().includes(q) || ev.action.toLowerCase().includes(q) || ev.target.toLowerCase().includes(q)
    return matchCat && matchSev && matchSearch
  })

  return (
    <div className="flex flex-col gap-6">

      {/* Filters */}
      <div className="bg-card border border-border rounded-lg px-5 py-4 flex flex-col gap-3">
        {/* Search row */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-48 border border-border rounded-md px-3 py-1.5 bg-background">
            <Search size={13} className="text-muted-foreground shrink-0" />
            <input
              type="text"
              placeholder="Search by actor, action, or target..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
            <Filter size={12} /> Filters
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 ml-auto">
            <Download size={12} /> Export CSV
          </Button>
        </div>

        {/* Category chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border capitalize transition-all",
                categoryFilter === cat
                  ? "border-primary bg-primary/8 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {cat}
            </button>
          ))}
          <span className="ml-2 text-xs text-muted-foreground">Severity:</span>
          {(["All", "info", "warning", "critical"] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={cn(
                "px-2.5 py-1 rounded-md text-xs font-medium border capitalize transition-all",
                severityFilter === sev
                  ? "border-primary bg-primary/8 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Event table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-secondary/40">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {filtered.length} event{filtered.length !== 1 ? "s" : ""}
          </span>
          <span className="text-xs text-muted-foreground">Showing last 30 days</span>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No events match your filters.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((ev) => {
              const Icon = CATEGORY_ICONS[ev.category]
              return (
                <div key={ev.id} className="flex items-start gap-4 px-6 py-4 hover:bg-secondary/30 transition-colors">
                  {/* Icon tile */}
                  <div className="w-8 h-8 rounded-lg bg-secondary border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={14} className="text-muted-foreground" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{ev.action}</p>
                      <span className={cn("text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded-full border", SEVERITY_STYLES[ev.severity])}>
                        {ev.severity}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{ev.target}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className="text-[11px] text-muted-foreground">
                        by <span className="font-medium text-foreground">{ev.actor}</span> ({ev.actorRole})
                      </span>
                      <span className="text-[11px] text-muted-foreground">&middot; {ev.ip}</span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5 text-right whitespace-nowrap">
                    {ev.timestamp}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground px-1">
        Audit logs are retained for 90 days on the Growth plan and 365 days on Enterprise.
        <a href="/settings/billing" className="text-primary hover:underline font-medium ml-1">Upgrade to extend retention.</a>
      </p>
    </div>
  )
}
