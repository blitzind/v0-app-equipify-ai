"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Plug, Settings2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { cn } from "@/lib/utils"
import {
  INTEGRATION_READINESS_BADGE,
  SETTINGS_HUB_INTEGRATION_READINESS,
  type SettingsHubIntegrationId,
} from "@/lib/integrations/catalog-metadata"

interface Integration {
  id: SettingsHubIntegrationId
  name: string
  description: string
  category: string
  logo: string
  /** Real navigation target (QuickBooks wizard, billing, etc.). */
  detailHref?: string
  detailLabel?: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync invoices, customers, and payments with QuickBooks automatically.",
    category: "Accounting",
    logo: "QB",
    detailHref: "/settings/integrations/quickbooks",
    detailLabel: "Manage connection",
  },
  {
    id: "stripe",
    name: "Stripe (billing)",
    description:
      "Plans and Checkout live under Billing. Use Open billing — there is no separate Stripe “Connect” on this screen.",
    category: "Payments",
    logo: "ST",
    detailHref: "/settings/billing",
    detailLabel: "Open billing",
  },
  {
    id: "gmail",
    name: "Gmail (mailbox)",
    description:
      "Coming soon. Will connect a Google mailbox for optional staff workflows only. Invoices, quotes, invites, and system email today use Equipify’s transactional mail provider — Gmail would be additive, not a replacement, when it ships.",
    category: "Communication",
    logo: "GM",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync work orders and service appointments directly to your team's Google Calendars.",
    category: "Scheduling",
    logo: "GC",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Receive real-time alerts for overdue work orders, repeat repairs, and urgent escalations.",
    category: "Notifications",
    logo: "SL",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send SMS reminders to customers for upcoming appointments and maintenance.",
    category: "Notifications",
    logo: "TW",
  },
  {
    id: "salesforce",
    name: "Salesforce CRM",
    description: "Sync customer and equipment records bidirectionally with Salesforce.",
    category: "CRM",
    logo: "SF",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect Equipify to 6,000+ apps through Zapier's no-code automation platform.",
    category: "Automation",
    logo: "ZP",
  },
  {
    id: "docusign",
    name: "DocuSign",
    description: "Collect e-signatures on quotes, service agreements, and work orders.",
    category: "Documents",
    logo: "DS",
  },
]

const CATEGORIES = ["All", ...Array.from(new Set(INTEGRATIONS.map((i) => i.category)))]

const LOGO_COLORS: Record<string, string> = {
  QB: "#2ca01c",
  ST: "#635bff",
  GM: "#ea4335",
  GC: "#4285f4",
  SL: "#e01e5a",
  TW: "#f22f46",
  SF: "#00a1e0",
  ZP: "#ff4a00",
  DS: "#ffbe00",
}

type QuickBooksLive = "idle" | "loading" | "connected" | "disconnected" | "error"

function IntegrationCard({
  integration,
  quickBooksLive,
}: {
  integration: Integration
  quickBooksLive?: QuickBooksLive
}) {
  const color = LOGO_COLORS[integration.logo] ?? "#6b7280"
  const isLive = Boolean(integration.detailHref)

  const catalogReadiness = SETTINGS_HUB_INTEGRATION_READINESS[integration.id]
  const readinessBadge = INTEGRATION_READINESS_BADGE[catalogReadiness]

  const statusPill =
    integration.id === "quickbooks" && quickBooksLive === "idle" ?
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", readinessBadge.className)}>
        {readinessBadge.label}
      </span>
    : integration.id === "quickbooks" && quickBooksLive && quickBooksLive !== "idle" ?
      quickBooksLive === "loading" ?
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
          Checking…
        </span>
      : quickBooksLive === "connected" ?
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ds-badge-success border">
          Connected
        </span>
      : quickBooksLive === "disconnected" ?
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
          Not connected
        </span>
      : quickBooksLive === "error" ?
        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-destructive/35 text-destructive bg-destructive/10">
          Needs attention
        </span>
      : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
          Status unavailable
        </span>
    : isLive ?
      integration.id === "stripe" ?
        <span
          className={cn(
            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
            readinessBadge.className,
          )}
        >
          {readinessBadge.label}
        </span>
      : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ds-badge-info border">Setup</span>
    : <span
        className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", readinessBadge.className)}
      >
        {readinessBadge.label}
      </span>

  return (
    <div
      className={cn(
        "bg-card border rounded-xl p-5 flex flex-col gap-4 transition-shadow",
        isLive ? "border-border" : "border-border/80 opacity-95",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold"
          style={{ background: color }}
        >
          {integration.logo}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground">{integration.name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary border border-border text-muted-foreground font-medium">
              {integration.category}
            </span>
            {statusPill}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{integration.description}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {integration.detailHref ? (
          <Button size="sm" variant="outline" className="text-xs h-7 gap-1.5" asChild>
            <Link href={integration.detailHref}>
              <Settings2 size={11} /> {integration.detailLabel ?? "Manage"}
            </Link>
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="text-xs h-7" disabled title="No OAuth or setup flow in Equipify for this connector yet">
            No in-app setup yet
          </Button>
        )}
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const [activeCategory, setActiveCategory] = useState("All")
  const [quickBooksLive, setQuickBooksLive] = useState<QuickBooksLive>("idle")

  useEffect(() => {
    if (orgStatus !== "ready" || !organizationId) {
      setQuickBooksLive("idle")
      return
    }
    let cancelled = false
    setQuickBooksLive("loading")
    void (async () => {
      try {
        const res = await fetch(
          `/api/organizations/${encodeURIComponent(organizationId)}/integrations/quickbooks`,
          { cache: "no-store" },
        )
        if (cancelled) return
        if (!res.ok) {
          setQuickBooksLive("error")
          return
        }
        const j = (await res.json()) as { integration?: { connection_status?: string } | null }
        const st = j.integration?.connection_status
        if (st === "connected") setQuickBooksLive("connected")
        else if (st === "error") setQuickBooksLive("error")
        else setQuickBooksLive("disconnected")
      } catch {
        if (!cancelled) setQuickBooksLive("error")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, orgStatus])

  const filtered =
    activeCategory === "All" ? INTEGRATIONS : INTEGRATIONS.filter((i) => i.category === activeCategory)

  const liveCount = INTEGRATIONS.filter((i) => i.detailHref).length

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <p className="text-sm font-medium text-foreground">How integrations work today</p>
        <p className="mt-1.5">
          Only <strong className="text-foreground">QuickBooks</strong> has a full OAuth connection flow on this page.{" "}
          <strong className="text-foreground">Stripe</strong> billing is managed under{" "}
          <Link href="/settings/billing" className="text-primary underline-offset-2 hover:underline">
            Billing
          </Link>
          . <strong className="text-foreground">Gmail</strong> is not connected anywhere in the app yet — customer-facing
          and system email uses <strong className="text-foreground">Resend</strong> today.
        </p>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card">
          <Plug size={13} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{liveCount} with setup link</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card">
          <span className="text-sm font-medium text-foreground">
            {INTEGRATIONS.length - liveCount} coming soon
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
              activeCategory === cat
                ? "border-primary bg-primary/8 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            quickBooksLive={integration.id === "quickbooks" ? quickBooksLive : undefined}
          />
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-5 py-4">
        <p className="text-sm font-medium text-foreground">Don&apos;t see what you need?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Request an integration or use the{" "}
          <Link href="/settings/api" className="text-primary hover:underline font-medium">
            Equipify API
          </Link>
          . The public <Link href="/integrations">Integrations</Link> catalog lists the same roadmap items and readiness labels.
        </p>
      </div>
    </div>
  )
}
