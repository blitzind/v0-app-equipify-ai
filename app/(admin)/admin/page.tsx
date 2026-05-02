"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2, Users, DollarSign, TrendingUp, Search, MoreHorizontal,
  LogIn, ShieldAlert, CheckCircle2, XCircle, Clock, Zap, AlertTriangle,
  ChevronRight, ArrowUpRight, Filter, Toggle, Info, Eye, Ban, RefreshCw,
  ScrollText, Gauge, Flag, Activity,
} from "lucide-react"
import { useAdmin } from "@/lib/admin-store"
import {
  PLATFORM_ACCOUNTS, PLATFORM_STATS, MRR_TREND, PLAN_DISTRIBUTION,
  FEATURE_FLAGS, ADMIN_AUDIT_LOG, CURRENT_PLATFORM_ADMIN,
  type PlatformAccount, type FeatureFlag,
} from "@/lib/admin-data"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BrandLogoOnLight } from "@/components/brand-logo"
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(cents: number) {
  return "$" + (cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })
}

function statusColor(status: PlatformAccount["status"]) {
  switch (status) {
    case "Active":    return { color: "#15803d", bg: "#f0fdf4" }
    case "Trialing":  return { color: "#b45309", bg: "#fffbeb" }
    case "Past Due":  return { color: "#dc2626", bg: "#fef2f2" }
    case "Canceled":  return { color: "#6b7280", bg: "#f3f4f6" }
    case "Suspended": return { color: "#6b7280", bg: "#f3f4f6" }
    default:          return { color: "#6b7280", bg: "#f3f4f6" }
  }
}

function planColor(plan: PlatformAccount["plan"]) {
  switch (plan) {
    case "Enterprise": return { color: "#7c3aed", bg: "#f5f3ff" }
    case "Growth":     return { color: "#1d4ed8", bg: "#eff6ff" }
    default:           return { color: "#b45309", bg: "#fffbeb" }
  }
}

function severityIcon(sev: string) {
  if (sev === "critical") return <ShieldAlert size={13} className="ds-icon-danger shrink-0" />
  if (sev === "warning")  return <AlertTriangle size={13} className="ds-icon-warning shrink-0" />
  return <Info size={13} className="ds-icon-info shrink-0" />
}

function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
}

type Tab = "accounts" | "analytics" | "flags" | "audit"

// ─── Sub-sections ─────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-5 flex items-start gap-4">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0" style={{ background: color + "18" }}>
        <Icon size={18} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold text-foreground leading-tight mt-0.5 ds-tabular">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function AccountsTab({ accounts, onImpersonate }: {
  accounts: PlatformAccount[]
  onImpersonate: (a: PlatformAccount) => void
}) {
  const [search, setSearch] = useState("")
  const [planFilter, setPlanFilter] = useState<string>("All")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [menuOpen, setMenuOpen] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      const q = search.toLowerCase()
      const matchQ = !q || a.name.toLowerCase().includes(q) || a.ownerEmail.toLowerCase().includes(q)
      const matchPlan = planFilter === "All" || a.plan === planFilter
      const matchStatus = statusFilter === "All" || a.status === statusFilter
      return matchQ && matchPlan && matchStatus
    })
  }, [accounts, search, planFilter, statusFilter])

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-48 bg-card border border-border rounded-lg px-3 py-2">
          <Search size={14} className="text-muted-foreground shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts, emails..."
            className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
        <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}
          className="input-base w-36 text-sm">
          {["All", "Starter", "Growth", "Enterprise"].map(p => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="input-base w-36 text-sm">
          {["All", "Active", "Trialing", "Past Due", "Canceled", "Suspended"].map(s => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} accounts</span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                {["Account", "Plan", "Status", "MRR", "Seats", "Work Orders", "Last Active", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((account) => {
                const sc = statusColor(account.status)
                const pc = planColor(account.plan)
                return (
                  <tr key={account.id} className="border-t border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: "var(--primary)" }}>
                          {account.name[0]}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{account.name}</p>
                          <p className="text-xs text-muted-foreground">{account.ownerEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: pc.color, background: pc.bg }}>
                        {account.plan}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: sc.color, background: sc.bg }}>
                        {account.status}
                        {account.status === "Trialing" && account.trialEndsAt && (
                          <span className="ml-1 font-normal opacity-70">
                            ends {new Date(account.trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium ds-tabular">
                      {account.mrr > 0 ? fmt$(account.mrr) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm ds-tabular text-muted-foreground">{account.seats}</td>
                    <td className="px-4 py-3 text-sm ds-tabular text-muted-foreground">{account.workOrderCount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{account.lastActive}</td>
                    <td className="px-4 py-3">
                      <div className="relative flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          onClick={() => onImpersonate(account)}
                        >
                          <LogIn size={11} /> Login as
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setMenuOpen(menuOpen === account.id ? null : account.id)}
                        >
                          <MoreHorizontal size={13} />
                        </Button>
                        {menuOpen === account.id && (
                          <div className="absolute right-0 top-8 z-50 w-48 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
                            onMouseLeave={() => setMenuOpen(null)}>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left"
                              onClick={() => { onImpersonate(account); setMenuOpen(null) }}>
                              <LogIn size={13} className="text-muted-foreground" /> Impersonate
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left">
                              <Eye size={13} className="text-muted-foreground" /> View details
                            </button>
                            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors text-left">
                              <RefreshCw size={13} className="text-muted-foreground" /> Reset password
                            </button>
                            <div className="border-t border-border">
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-[var(--ds-warning-bg)] ds-text-warning transition-colors text-left">
                                <Ban size={13} /> Suspend account
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function AnalyticsTab() {
  return (
    <div className="flex flex-col gap-6">
      {/* MRR trend chart */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Monthly Recurring Revenue</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Last 6 months</p>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold ds-text-success">
            <TrendingUp size={13} /> +{PLATFORM_STATS.mrrGrowth}% MoM
          </span>
        </div>
        <div className="p-6">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={MRR_TREND}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={v => "$" + (v / 100).toLocaleString()} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={64} />
              <Tooltip formatter={(v: number) => [fmt$(v), "MRR"]} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid var(--border)" }} />
              <Area type="monotone" dataKey="mrr" stroke="var(--primary)" strokeWidth={2} fill="url(#mrrGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Plan distribution */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLAN_DISTRIBUTION.map(({ plan, accounts, color }) => (
          <div key={plan} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background: color + "18" }}>{plan}</span>
              <span className="text-2xl font-bold ds-tabular">{accounts}</span>
            </div>
            <p className="text-xs text-muted-foreground">accounts</p>
            <div className="mt-3 h-1.5 rounded-full bg-border overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${(accounts / PLATFORM_STATS.totalAccounts) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Usage metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Accounts",  value: PLATFORM_STATS.totalAccounts.toString(),          icon: Building2, color: "#1d4ed8" },
          { label: "Active Seats",    value: PLATFORM_STATS.totalSeats.toString(),              icon: Users,     color: "#15803d" },
          { label: "Equipment Records", value: PLATFORM_STATS.totalEquipment.toLocaleString(), icon: Gauge,     color: "#b45309" },
          { label: "Work Orders",     value: PLATFORM_STATS.totalWorkOrders.toLocaleString(),   icon: Activity,  color: "#7c3aed" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} style={{ color }} />
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
            </div>
            <p className="text-xl font-bold ds-tabular">{value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function FlagsTab() {
  const [flags, setFlags] = useState(() =>
    FEATURE_FLAGS.map(f => ({ ...f, localEnabled: f.enabledFor !== "none" && f.enabledFor !== [] }))
  )

  const categories = Array.from(new Set(FEATURE_FLAGS.map(f => f.category)))

  function toggleFlag(id: string) {
    setFlags(prev => prev.map(f => f.id === id ? { ...f, localEnabled: !f.localEnabled } : f))
  }

  const categoryColor: Record<string, string> = {
    AI:         "#7c3aed",
    Billing:    "#15803d",
    Portal:     "#1d4ed8",
    Operations: "#b45309",
    Lab:        "#0891b2",
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-xl ds-alert-warning border px-5 py-3">
        <AlertTriangle size={14} className="mt-0.5 shrink-0 ds-icon-warning" />
        <p className="text-xs">Feature flags are global toggles. Changes take effect immediately for all accounts matching the target plan tier. Use caution.</p>
      </div>

      {categories.map(cat => (
        <div key={cat} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: categoryColor[cat] }}>{cat}</span>
          </div>
          <div className="divide-y divide-border">
            {flags.filter(f => f.category === cat).map(flag => {
              const on = flag.localEnabled
              const targetLabel = Array.isArray(flag.enabledFor)
                ? `${flag.enabledFor.length} specific accounts`
                : flag.enabledFor === "all" ? "All plans"
                : flag.enabledFor === "enterprise" ? "Enterprise only"
                : flag.enabledFor === "growth_up" ? "Growth + Enterprise"
                : "None"
              return (
                <div key={flag.id} className="flex items-start gap-4 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground">{flag.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">{flag.id}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
                    <p className="text-xs mt-1.5">
                      <span className="text-muted-foreground">Target: </span>
                      <span className="font-medium text-foreground">{targetLabel}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFlag(flag.id)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors mt-0.5",
                      on ? "bg-primary" : "bg-border"
                    )}
                    role="switch"
                    aria-checked={on}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
                      on ? "translate-x-4" : "translate-x-0"
                    )} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

function AuditTab() {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="text-sm font-semibold">Platform audit log</h3>
        <p className="text-xs text-muted-foreground mt-0.5">All admin actions across Equipify.ai</p>
      </div>
      <div className="divide-y divide-border">
        {ADMIN_AUDIT_LOG.map(event => (
          <div key={event.id} className="flex items-start gap-3 px-6 py-4">
            <div className="mt-0.5">{severityIcon(event.severity)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">{event.actor}</span>
                <span className="text-[10px] px-1.5 py-px rounded-full bg-secondary text-muted-foreground">{event.actorRole}</span>
                <span className="text-xs text-muted-foreground font-mono">{event.action.replace(/_/g, " ")}</span>
                <span className="text-xs font-medium text-foreground">{event.target}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{event.detail}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0 ds-tabular whitespace-nowrap">
              {new Date(event.timestamp).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlatformAdminPage() {
  const router = useRouter()
  const { impersonation, startImpersonation, endImpersonation } = useAdmin()
  const [activeTab, setActiveTab] = useState<Tab>("accounts")

  function handleImpersonate(account: PlatformAccount) {
    startImpersonation(account)
    router.push("/")
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "accounts",  label: "Accounts",   icon: Building2 },
    { key: "analytics", label: "Analytics",  icon: TrendingUp },
    { key: "flags",     label: "Feature Flags", icon: Flag },
    { key: "audit",     label: "Audit Log",  icon: ScrollText },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="flex items-center h-14 px-6 bg-card border-b border-border gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <BrandLogoOnLight logoClassName="h-7" />
          <span className="ml-2 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#7c3aed]/10 text-[#7c3aed] border border-[#7c3aed]/20">
            Platform Admin
          </span>
        </div>
        <div className="flex-1" />
        {/* Admin identity */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#7c3aed] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {initials(CURRENT_PLATFORM_ADMIN.name)}
          </div>
          <div className="hidden sm:block">
            <p className="text-xs font-semibold text-foreground leading-tight">{CURRENT_PLATFORM_ADMIN.name}</p>
            <p className="text-[10px] text-muted-foreground">{CURRENT_PLATFORM_ADMIN.role}</p>
          </div>
        </div>
        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-4">
          Back to app <ChevronRight size={12} />
        </Link>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Building2}   label="Total Accounts"  value={PLATFORM_STATS.totalAccounts.toString()} sub={`${PLATFORM_STATS.activeAccounts} active`} color="#1d4ed8" />
          <StatCard icon={DollarSign}  label="Total MRR"       value={fmt$(PLATFORM_STATS.totalMrr)} sub={`+${PLATFORM_STATS.mrrGrowth}% MoM`} color="#15803d" />
          <StatCard icon={Users}       label="Active Seats"    value={PLATFORM_STATS.totalSeats.toString()} sub="across all accounts" color="#b45309" />
          <StatCard icon={TrendingUp}  label="Account Growth"  value={`+${PLATFORM_STATS.accountGrowth}%`} sub="MoM new signups" color="#7c3aed" />
        </div>

        {/* Tabs */}
        <div className="flex flex-col gap-6">
          <nav className="flex items-center gap-1 border-b border-border">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                  activeTab === key
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>

          {activeTab === "accounts"  && <AccountsTab accounts={PLATFORM_ACCOUNTS} onImpersonate={handleImpersonate} />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "flags"     && <FlagsTab />}
          {activeTab === "audit"     && <AuditTab />}
        </div>
      </div>
    </div>
  )
}
