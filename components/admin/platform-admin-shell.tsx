"use client"

import Link from "next/link"
import type { ElementType, ReactNode } from "react"
import {
  Brain,
  Building2,
  ChevronRight,
  CreditCard,
  Database,
  Flag,
  ScrollText,
  Target,
  TrendingUp,
} from "lucide-react"
import { BrandLogo } from "@/components/brand-logo"
import { cn } from "@/lib/utils"
import { initialsFromDisplayLabel } from "@/lib/user-display"

export const PLATFORM_ADMIN_INLINE_TABS = [
  { key: "accounts", label: "Accounts", icon: Building2 },
  { key: "analytics", label: "Analytics", icon: TrendingUp },
  { key: "flags", label: "Feature Flags", icon: Flag },
  { key: "audit", label: "Audit Log", icon: ScrollText },
  { key: "ai_operations", label: "AI Operations", icon: Brain },
  { key: "import_operations", label: "Import Ops", icon: Database },
  { key: "master_context", label: "Master Context", icon: ScrollText },
  { key: "blitzpay_operations", label: "BlitzPay Ops", icon: CreditCard },
] as const

export type PlatformAdminInlineTab = (typeof PLATFORM_ADMIN_INLINE_TABS)[number]["key"]

export type PlatformAdminTabKey = PlatformAdminInlineTab | "growth_leads"

export const PLATFORM_ADMIN_GROWTH_LEADS_TAB = {
  key: "growth_leads",
  label: "Growth Engine",
  icon: Target,
  href: "/admin/growth/command",
} as const

const INLINE_TAB_KEYS = new Set<string>(PLATFORM_ADMIN_INLINE_TABS.map((tab) => tab.key))

export function isPlatformAdminInlineTab(value: string | null | undefined): value is PlatformAdminInlineTab {
  return Boolean(value && INLINE_TAB_KEYS.has(value))
}

export function platformAdminInlineTabHref(tab: PlatformAdminInlineTab): string {
  return `/admin?tab=${tab}`
}

type PlatformAdminHeaderProps = {
  line1: string
  line2: string
  initials: string
}

export function PlatformAdminHeader({ line1, line2, initials }: PlatformAdminHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-4 border-b border-white/10 bg-[#0F172A] px-6">
      <div className="flex items-center gap-2">
        <BrandLogo className="h-7 w-auto max-h-7" priority />
        <span className="ml-2 rounded-full border border-violet-400/25 bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-violet-200">
          Platform Admin
        </span>
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#7c3aed] text-[11px] font-bold text-white">
          {initials}
        </div>
        <div className="hidden sm:block">
          <p className="text-xs font-semibold leading-tight text-white">{line1}</p>
          <p className="text-[10px] text-slate-400">{line2}</p>
        </div>
      </div>
      <Link href="/" className="ml-4 flex items-center gap-1.5 text-xs text-slate-400 transition-colors hover:text-white">
        Back to app <ChevronRight size={12} />
      </Link>
    </header>
  )
}

export function usePlatformAdminHeaderIdentity(input: {
  displayName?: string | null
  email?: string | null
  platformRoleLabel?: string | null
}) {
  const displayName = input.displayName?.trim() ?? ""
  const email = input.email?.trim() ?? ""
  const line1 = displayName || email || "…"
  const line2 =
    displayName && email && displayName.toLowerCase() !== email.toLowerCase()
      ? email
      : (input.platformRoleLabel ?? "Platform Admin")
  const initials = initialsFromDisplayLabel(displayName || email || "?")
  return { line1, line2, initials }
}

type PlatformAdminTabNavProps = {
  activeKey: PlatformAdminTabKey
  onInlineTabSelect?: (tab: PlatformAdminInlineTab) => void
}

function tabNavClassName(isActive: boolean) {
  return cn(
    "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium -mb-px transition-colors shrink-0",
    isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
  )
}

function InlineTabItem({
  tab,
  isActive,
  onInlineTabSelect,
}: {
  tab: (typeof PLATFORM_ADMIN_INLINE_TABS)[number]
  isActive: boolean
  onInlineTabSelect?: (tab: PlatformAdminInlineTab) => void
}) {
  const Icon = tab.icon as ElementType
  const className = tabNavClassName(isActive)

  if (onInlineTabSelect) {
    return (
      <button type="button" onClick={() => onInlineTabSelect(tab.key)} className={className}>
        <Icon size={14} /> {tab.label}
      </button>
    )
  }

  return (
    <Link href={platformAdminInlineTabHref(tab.key)} className={className}>
      <Icon size={14} /> {tab.label}
    </Link>
  )
}

export function PlatformAdminTabNav({ activeKey, onInlineTabSelect }: PlatformAdminTabNavProps) {
  const GrowthIcon = PLATFORM_ADMIN_GROWTH_LEADS_TAB.icon

  return (
    <nav className="flex items-center gap-1 overflow-x-auto border-b border-border pb-px [scrollbar-width:thin]">
      {PLATFORM_ADMIN_INLINE_TABS.map((tab) => (
        <InlineTabItem
          key={tab.key}
          tab={tab}
          isActive={activeKey === tab.key}
          onInlineTabSelect={onInlineTabSelect}
        />
      ))}
      <Link
        href={PLATFORM_ADMIN_GROWTH_LEADS_TAB.href}
        className={tabNavClassName(activeKey === PLATFORM_ADMIN_GROWTH_LEADS_TAB.key)}
      >
        <GrowthIcon size={14} /> {PLATFORM_ADMIN_GROWTH_LEADS_TAB.label}
      </Link>
    </nav>
  )
}

export function PlatformAdminPageShell({
  header,
  children,
}: {
  header: PlatformAdminHeaderProps
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <PlatformAdminHeader {...header} />
      {children}
    </div>
  )
}
