"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Plug, CheckCircle2, Clock, Zap, ArrowRight,
  Star, X, ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useBillingAccess } from "@/lib/billing-access-context"

// ─── Types ────────────────────────────────────────────────────────────────────

type IntegrationStatus = "available" | "beta" | "coming_soon" | "connected"

interface Integration {
  id: string
  name: string
  description: string
  status: IntegrationStatus
  category: string
  logoLetter: string
  logoColor: string
  featured?: boolean
  featuredDescription?: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const INTEGRATIONS: Integration[] = [
  // Core Business
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description: "Sync customers, invoices, payments, and financial data.",
    status: "coming_soon",
    category: "Core Business",
    logoLetter: "Q",
    logoColor: "#2ca01c",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Accept payments, subscriptions, deposits, and autopay.",
    status: "coming_soon",
    category: "Core Business",
    logoLetter: "S",
    logoColor: "#635bff",
  },
  {
    id: "fuzor",
    name: "Fuzor",
    description: "CRM, automations, pipelines, reminders, and communication.",
    status: "beta",
    category: "Core Business",
    logoLetter: "F",
    logoColor: "#0f7ae5",
    featured: true,
    featuredDescription: "Power Equipify.ai with CRM automation, reminders, follow-up, lead capture, and revenue workflows.",
  },
  {
    id: "xero",
    name: "Xero",
    description: "Cloud accounting for growing businesses.",
    status: "coming_soon",
    category: "Core Business",
    logoLetter: "X",
    logoColor: "#13b5ea",
  },
  // Communication
  {
    id: "twilio",
    name: "Twilio",
    description: "SMS reminders, alerts, ETA notices, and messaging.",
    status: "coming_soon",
    category: "Communication",
    logoLetter: "T",
    logoColor: "#f22f46",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Send quotes, invoices, and notifications.",
    status: "coming_soon",
    category: "Communication",
    logoLetter: "G",
    logoColor: "#ea4335",
  },
  {
    id: "microsoft365",
    name: "Microsoft 365",
    description: "Email and Outlook workflow sync.",
    status: "coming_soon",
    category: "Communication",
    logoLetter: "M",
    logoColor: "#d83b01",
  },
  // Scheduling
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync technician schedules and appointments.",
    status: "coming_soon",
    category: "Scheduling",
    logoLetter: "G",
    logoColor: "#4285f4",
  },
  {
    id: "outlook-calendar",
    name: "Outlook Calendar",
    description: "Calendar sync for Microsoft environments.",
    status: "coming_soon",
    category: "Scheduling",
    logoLetter: "O",
    logoColor: "#0078d4",
  },
  // Automation
  {
    id: "zapier",
    name: "Zapier",
    description: "Connect thousands of apps without code.",
    status: "coming_soon",
    category: "Automation",
    logoLetter: "Z",
    logoColor: "#ff4a00",
  },
  {
    id: "make",
    name: "Make",
    description: "Advanced visual automation workflows.",
    status: "coming_soon",
    category: "Automation",
    logoLetter: "M",
    logoColor: "#7d2ae8",
  },
  {
    id: "n8n",
    name: "n8n",
    description: "Open-source automation for advanced teams.",
    status: "coming_soon",
    category: "Automation",
    logoLetter: "n",
    logoColor: "#ea4b71",
  },
  // Documents / Approvals
  {
    id: "docusign",
    name: "DocuSign",
    description: "Digital signatures for quotes and contracts.",
    status: "coming_soon",
    category: "Documents & Approvals",
    logoLetter: "D",
    logoColor: "#ffbe00",
  },
  {
    id: "pandadoc",
    name: "PandaDoc",
    description: "Quotes, proposals, and approvals.",
    status: "coming_soon",
    category: "Documents & Approvals",
    logoLetter: "P",
    logoColor: "#3ab74d",
  },
  // Maps / Routing
  {
    id: "google-maps",
    name: "Google Maps",
    description: "Routing, directions, and job locations.",
    status: "coming_soon",
    category: "Maps & Routing",
    logoLetter: "G",
    logoColor: "#34a853",
  },
]

const CATEGORIES = [
  "Core Business",
  "Communication",
  "Scheduling",
  "Automation",
  "Documents & Approvals",
  "Maps & Routing",
]

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<IntegrationStatus, {
  label: string
  className: string
  cta: string
  ctaVariant: "default" | "outline" | "secondary"
}> = {
  available:   { label: "Available",    className: "ds-badge-success border",      cta: "Connect",     ctaVariant: "default" },
  beta:        { label: "Beta",         className: "ds-badge-info border",         cta: "Connect",     ctaVariant: "default" },
  coming_soon: { label: "Coming Soon",  className: "ds-badge-warning border",      cta: "Notify Me",   ctaVariant: "outline" },
  connected:   { label: "Connected",    className: "ds-badge-success border",      cta: "Manage",      ctaVariant: "secondary" },
}

// ─── KPI summary ──────────────────────────────────────────────────────────────

const available  = INTEGRATIONS.filter((i) => i.status === "available" || i.status === "beta").length
const comingSoon = INTEGRATIONS.filter((i) => i.status === "coming_soon").length
const connected  = INTEGRATIONS.filter((i) => i.status === "connected").length

const KPIS = [
  { label: "Available Integrations", value: String(available),  icon: Plug,         tile: "ds-icon-tile-primary" },
  { label: "Coming Soon",            value: String(comingSoon), icon: Clock,        tile: "ds-icon-tile-warning" },
  { label: "Connected Apps",         value: String(connected),  icon: CheckCircle2, tile: "ds-icon-tile-success" },
  { label: "Automation Ready",       value: "12",               icon: Zap,          tile: "ds-icon-tile-accent"  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function IntegrationCard({
  integration,
  onNotify,
}: {
  integration: Integration
  onNotify: (id: string, name: string) => void
}) {
  const cfg = STATUS_CONFIG[integration.status]
  const isComingSoon = integration.status === "coming_soon"

  function handleCTA() {
    if (isComingSoon) onNotify(integration.id, integration.name)
  }

  return (
    <div className="ds-card flex flex-col gap-4 p-5 hover:ds-shadow-hover transition-shadow">
      <div className="flex items-start justify-between gap-3">
        {/* Logo */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0 shadow-sm"
          style={{ backgroundColor: integration.logoColor }}
          aria-hidden="true"
        >
          {integration.logoLetter}
        </div>
        {/* Status badge */}
        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold", cfg.className)}>
          {cfg.label}
        </span>
      </div>

      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{integration.name}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{integration.description}</p>
      </div>

      <Button
        size="sm"
        variant={cfg.ctaVariant}
        className="w-full cursor-pointer"
        onClick={handleCTA}
      >
        {cfg.cta}
        {!isComingSoon && <ChevronRight className="w-3.5 h-3.5 ml-1" />}
      </Button>
    </div>
  )
}

function FuzorFeaturedCard({ onConnect }: { onConnect: () => void }) {
  return (
    <div className="relative bg-card border border-primary/30 rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(15,122,229,0.10)] mb-8">
      {/* Subtle top accent bar */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-md" style={{ backgroundColor: "#0f7ae5" }}>
          F
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-base font-semibold text-foreground">Fuzor</p>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ds-badge-info border">
              Beta
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Star className="w-3 h-3" />
              Recommended
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Power Equipify.ai with CRM automation, reminders, follow-up, lead capture, and revenue workflows.
          </p>
        </div>

        {/* CTA */}
        <Button className="shrink-0 gap-2 cursor-pointer" onClick={onConnect}>
          Connect Fuzor
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Waitlist modal ───────────────────────────────────────────────────────────

function WaitlistModal({
  name,
  onClose,
}: {
  name: string
  onClose: () => void
}) {
  const [form, setForm] = useState({ name: "", email: "", company: "" })
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div className="relative bg-card border border-border rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.16)] w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <p className="text-base font-semibold text-foreground">Coming Soon</p>
            <p className="text-xs text-muted-foreground mt-0.5">{name}</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--ds-success-bg)] border border-[var(--ds-success-border)] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" style={{ color: "var(--ds-success-subtle)" }} />
              </div>
              <p className="text-sm font-semibold text-foreground">{"You're on the list!"}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {"We'll notify you as soon as "}
                {name}
                {" is available."}
              </p>
              <Button className="mt-2 cursor-pointer" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                This integration is planned for a future release. Join the waitlist to be notified when it launches.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wl-name" className="text-xs font-medium text-foreground">Name</label>
                  <input
                    id="wl-name"
                    type="text"
                    required
                    placeholder="Your full name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wl-email" className="text-xs font-medium text-foreground">Email</label>
                  <input
                    id="wl-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wl-company" className="text-xs font-medium text-foreground">Company</label>
                  <input
                    id="wl-company"
                    type="text"
                    placeholder="Company name"
                    value={form.company}
                    onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                    className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full cursor-pointer">Notify Me</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Request Integration modal ────────────────────────────────────────────────

function RequestIntegrationModal({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", integration: "", useCase: "" })
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-card border border-border rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.16)] w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <p className="text-base font-semibold text-foreground">Request an Integration</p>
            <p className="text-xs text-muted-foreground mt-0.5">{"Tell us what you need and we'll prioritize it."}</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5">
          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--ds-success-bg)] border border-[var(--ds-success-border)] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" style={{ color: "var(--ds-success-subtle)" }} />
              </div>
              <p className="text-sm font-semibold text-foreground">Request received!</p>
              <p className="text-xs text-muted-foreground leading-relaxed">Our team will review your integration request and be in touch soon.</p>
              <Button className="mt-2 cursor-pointer" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-name" className="text-xs font-medium text-foreground">Name</label>
                  <input id="ri-name" type="text" required placeholder="Your full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-email" className="text-xs font-medium text-foreground">Email</label>
                  <input id="ri-email" type="email" required placeholder="you@company.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-integration" className="text-xs font-medium text-foreground">Integration name</label>
                  <input id="ri-integration" type="text" required placeholder="e.g. Salesforce, Slack..." value={form.integration} onChange={(e) => setForm((f) => ({ ...f, integration: e.target.value }))} className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-use-case" className="text-xs font-medium text-foreground">Use case <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <textarea id="ri-use-case" rows={3} placeholder="Describe how you'd use this integration..." value={form.useCase} onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))} className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground resize-none leading-relaxed" />
                </div>
              </div>
              <Button type="submit" className="w-full cursor-pointer">Submit Request</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { apiFeaturesAllowed } = useBillingAccess()
  const [notifyModal, setNotifyModal] = useState<{ id: string; name: string } | null>(null)
  const [requestModal, setRequestModal] = useState(false)

  function handleNotify(id: string, name: string) {
    setNotifyModal({ id, name })
  }

  return (
    <div className="flex flex-col gap-6">
      {!apiFeaturesAllowed && (
        <div className="rounded-lg border border-muted px-4 py-3 text-sm text-muted-foreground bg-secondary/30">
          Full integration and API access is available on the Scale plan.{" "}
          <Link href="/settings/billing" className="font-medium text-foreground underline-offset-2 hover:underline">
            View billing
          </Link>
        </div>
      )}

      {/* ── Page header card ── */}
      <div className="flex items-center gap-3 sm:gap-4 bg-card border border-border rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] px-4 sm:px-6 py-4 sm:py-5">
        <div
          className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border flex items-center justify-center shrink-0"
          style={{
            backgroundColor: "color-mix(in srgb, #2563eb 14%, var(--card))",
            borderColor: "color-mix(in srgb, #2563eb 24%, var(--border))",
          }}
        >
          <Plug className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" style={{ color: "#2563eb" }} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-tight text-balance">
            Integrations
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed line-clamp-1">
            Connect Equipify.ai with the tools you already use to automate workflows, sync data, and streamline operations.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-2 cursor-pointer"
          onClick={() => setRequestModal(true)}
        >
          Request Integration
        </Button>
      </div>

      {/* ── KPI summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map(({ label, value, icon: Icon, tile }) => (
          <div key={label} className="ds-kpi-card">
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", tile)}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="ds-kpi-value">{value}</p>
            <p className="ds-kpi-label">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Fuzor featured card ── */}
      <FuzorFeaturedCard onConnect={() => window.open("https://fuzor.io", "_blank", "noopener,noreferrer")} />

      {/* ── Integration categories ── */}
      {CATEGORIES.map((category) => {
        const items = INTEGRATIONS.filter(
          (i) => i.category === category && !i.featured
        )
        if (items.length === 0) return null
        return (
          <section key={category} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">{category}</h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{items.length} integration{items.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((integration) => (
                <IntegrationCard
                  key={integration.id}
                  integration={integration}
                  onNotify={handleNotify}
                />
              ))}
            </div>
          </section>
        )
      })}

      {/* ── Waitlist modal ── */}
      {notifyModal && (
        <WaitlistModal
          name={notifyModal.name}
          onClose={() => setNotifyModal(null)}
        />
      )}

      {/* ── Request Integration modal ── */}
      {requestModal && (
        <RequestIntegrationModal onClose={() => setRequestModal(false)} />
      )}
    </div>
  )
}
