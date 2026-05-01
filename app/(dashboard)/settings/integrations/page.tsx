"use client"

import { useState } from "react"
import { Check, ExternalLink, Plug, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface Integration {
  id: string
  name: string
  description: string
  category: string
  connected: boolean
  connectedAs?: string
  logo: string
}

const INTEGRATIONS: Integration[] = [
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync invoices, customers, and payments with QuickBooks automatically.",
    category: "Accounting",
    connected: true,
    connectedAs: "acmecorp@quickbooks.com",
    logo: "QB",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept credit card payments and manage subscriptions through the customer portal.",
    category: "Payments",
    connected: true,
    connectedAs: "Acme Corp (acct_1abc)",
    logo: "ST",
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync work orders and service appointments directly to your team's Google Calendars.",
    category: "Scheduling",
    connected: false,
    logo: "GC",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Receive real-time alerts for overdue work orders, repeat repairs, and urgent escalations.",
    category: "Notifications",
    connected: false,
    logo: "SL",
  },
  {
    id: "twilio",
    name: "Twilio SMS",
    description: "Send SMS reminders to customers for upcoming appointments and maintenance.",
    category: "Notifications",
    connected: false,
    logo: "TW",
  },
  {
    id: "salesforce",
    name: "Salesforce CRM",
    description: "Sync customer and equipment records bidirectionally with Salesforce.",
    category: "CRM",
    connected: false,
    logo: "SF",
  },
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect Equipify to 6,000+ apps through Zapier's no-code automation platform.",
    category: "Automation",
    connected: false,
    logo: "ZP",
  },
  {
    id: "docusign",
    name: "DocuSign",
    description: "Collect e-signatures on quotes, service agreements, and work orders.",
    category: "Documents",
    connected: false,
    logo: "DS",
  },
]

const CATEGORIES = ["All", ...Array.from(new Set(INTEGRATIONS.map((i) => i.category)))]

const LOGO_COLORS: Record<string, string> = {
  QB: "#2ca01c",
  ST: "#635bff",
  GC: "#4285f4",
  SL: "#e01e5a",
  TW: "#f22f46",
  SF: "#00a1e0",
  ZP: "#ff4a00",
  DS: "#ffbe00",
}

function IntegrationCard({ integration, onToggle }: {
  integration: Integration
  onToggle: (id: string) => void
}) {
  const color = LOGO_COLORS[integration.logo] ?? "#6b7280"

  return (
    <div className={cn(
      "bg-card border rounded-xl p-5 flex flex-col gap-4 transition-shadow",
      integration.connected ? "border-primary/30 shadow-sm" : "border-border"
    )}>
      <div className="flex items-start gap-3">
        {/* Logo tile */}
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
            {integration.connected && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full ds-badge-success border">
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{integration.description}</p>
          {integration.connected && integration.connectedAs && (
            <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
              {integration.connectedAs}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={integration.connected ? "outline" : "default"}
          className={cn(
            "text-xs h-7 gap-1.5",
            integration.connected && "border-destructive/30 text-destructive hover:bg-destructive/5"
          )}
          onClick={() => onToggle(integration.id)}
        >
          {integration.connected ? "Disconnect" : <><Plug size={11} /> Connect</>}
        </Button>
        {integration.connected && (
          <Button size="sm" variant="ghost" className="text-xs h-7 gap-1.5 text-muted-foreground">
            <RefreshCw size={11} /> Sync now
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-xs h-7 gap-1.5 text-muted-foreground ml-auto">
          Docs <ExternalLink size={10} />
        </Button>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState(INTEGRATIONS)
  const [activeCategory, setActiveCategory] = useState("All")

  function toggleIntegration(id: string) {
    setIntegrations((prev) =>
      prev.map((i) => i.id === id ? { ...i, connected: !i.connected } : i)
    )
  }

  const filtered = activeCategory === "All"
    ? integrations
    : integrations.filter((i) => i.category === activeCategory)

  const connectedCount = integrations.filter((i) => i.connected).length

  return (
    <div className="flex flex-col gap-6">

      {/* Header stats */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card">
          <Check size={13} className="ds-icon-success" />
          <span className="text-sm font-medium text-foreground">{connectedCount} connected</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card">
          <Plug size={13} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{integrations.length - connectedCount} available</span>
        </div>
      </div>

      {/* Category filter */}
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
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((integration) => (
          <IntegrationCard
            key={integration.id}
            integration={integration}
            onToggle={toggleIntegration}
          />
        ))}
      </div>

      {/* Request integration */}
      <div className="rounded-lg border border-dashed border-border bg-secondary/30 px-5 py-4">
        <p className="text-sm font-medium text-foreground">Don&apos;t see what you need?</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Request an integration or build your own using the{" "}
          <a href="/settings/api" className="text-primary hover:underline font-medium">Equipify API</a>.
          We ship new integrations every month.
        </p>
        <Button size="sm" variant="outline" className="mt-3 text-xs h-7">Request an integration</Button>
      </div>
    </div>
  )
}
