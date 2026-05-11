"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Plug,
  CheckCircle2,
  Clock,
  ArrowRight,
  Star,
  X,
  ChevronRight,
  Route,
  Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { cn } from "@/lib/utils"
import { useBillingAccess } from "@/lib/billing-access-context"
import {
  INTEGRATION_READINESS_BADGE,
  MARKETING_INTEGRATION_CATALOG,
  MARKETING_INTEGRATION_CATEGORIES,
  countMarketingCatalogByReadiness,
  type MarketingCatalogEntry,
} from "@/lib/integrations/catalog-metadata"

const liveCount = countMarketingCatalogByReadiness("live")
const limitedCount = countMarketingCatalogByReadiness("limited")
const betaCount = countMarketingCatalogByReadiness("beta")
const roadmapCount =
  countMarketingCatalogByReadiness("planned") +
  countMarketingCatalogByReadiness("coming_soon")

const KPIS = [
  {
    label: "Live connectors",
    value: String(liveCount),
    icon: CheckCircle2,
    tile: "ds-icon-tile-success",
  },
  {
    label: "Limited / billing",
    value: String(limitedCount),
    icon: Layers,
    tile: "ds-icon-tile-primary",
  },
  {
    label: "Beta partners",
    value: String(betaCount),
    icon: Plug,
    tile: "ds-icon-tile-accent",
  },
  {
    label: "On the roadmap",
    value: String(roadmapCount),
    icon: Route,
    tile: "ds-icon-tile-warning",
  },
]

function CatalogCard({
  entry,
  onInterest,
}: {
  entry: MarketingCatalogEntry
  onInterest: (name: string) => void
}) {
  const badge = INTEGRATION_READINESS_BADGE[entry.readiness]

  return (
    <div className="ds-card flex flex-col gap-4 p-5 hover:ds-shadow-hover transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-base font-bold shrink-0 shadow-sm"
          style={{ backgroundColor: entry.logoColor }}
          aria-hidden="true"
        >
          {entry.logoLetter}
        </div>
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
            badge.className,
          )}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">{entry.name}</p>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{entry.description}</p>
      </div>

      {entry.cta.kind === "link" ? (
        <Button size="sm" variant="default" className="w-full gap-1 cursor-pointer" asChild>
          <Link href={entry.cta.href}>
            {entry.cta.label}
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      ) : entry.cta.kind === "external" ? (
        <Button
          size="sm"
          variant="default"
          className="w-full gap-1 cursor-pointer"
          onClick={() => window.open(entry.cta.href, "_blank", "noopener,noreferrer")}
        >
          {entry.cta.label}
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="w-full cursor-pointer"
          onClick={() => onInterest(entry.name)}
        >
          Register interest
        </Button>
      )}
    </div>
  )
}

function FuzorFeaturedCard({ entry }: { entry: MarketingCatalogEntry }) {
  if (!entry.featured || entry.cta.kind !== "external") return null
  const badge = INTEGRATION_READINESS_BADGE[entry.readiness]

  return (
    <div className="relative bg-card border border-primary/30 rounded-xl overflow-hidden shadow-[0_4px_16px_rgba(15,122,229,0.10)] mb-8">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-md"
          style={{ backgroundColor: entry.logoColor }}
        >
          {entry.logoLetter}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-base font-semibold text-foreground">{entry.name}</p>
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                badge.className,
              )}
            >
              {badge.label}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <Star className="w-3 h-3" />
              Partner
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            {entry.featuredDescription ?? entry.description}
          </p>
        </div>

        <Button
          className="shrink-0 gap-2 cursor-pointer"
          onClick={() => window.open(entry.cta.href, "_blank", "noopener,noreferrer")}
        >
          {entry.cta.label}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

const INTEREST_MODAL_PREVIEW_NOTE =
  "Preview only — this form does not send data to Equipify servers. Use it to copy what you might send support, or tell your admin what you need."

function InterestModal({
  integrationName,
  onClose,
}: {
  integrationName: string
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
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative bg-card border border-border rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.16)] w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-border">
          <div>
            <p className="text-base font-semibold text-foreground">Register interest</p>
            <p className="text-xs text-muted-foreground mt-0.5">{integrationName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 flex flex-col gap-4">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Not wired to our backend</AlertTitle>
            <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
              {INTEREST_MODAL_PREVIEW_NOTE}
            </AlertDescription>
          </Alert>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--ds-success-bg)] border border-[var(--ds-success-border)] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" style={{ color: "var(--ds-success-subtle)" }} />
              </div>
              <p className="text-sm font-semibold text-foreground">Captured locally only</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No request was sent to Equipify. If you need this integration, contact your workspace admin or Equipify
                support through your normal channel.
              </p>
              <Button className="mt-2 cursor-pointer" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Planned integration — tell us who you are so you can paste this into email or internal notes.
              </p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wl-name" className="text-xs font-medium text-foreground">
                    Name
                  </label>
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
                  <label htmlFor="wl-email" className="text-xs font-medium text-foreground">
                    Email
                  </label>
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
                  <label htmlFor="wl-company" className="text-xs font-medium text-foreground">
                    Company
                  </label>
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
              <Button type="submit" className="w-full cursor-pointer">
                Continue (local preview)
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

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
            <p className="text-xs text-muted-foreground mt-0.5">
              Draft details locally — nothing is submitted to Equipify from this dialog.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-4">
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>Preview only</AlertTitle>
            <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
              {INTEREST_MODAL_PREVIEW_NOTE}
            </AlertDescription>
          </Alert>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--ds-success-bg)] border border-[var(--ds-success-border)] flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" style={{ color: "var(--ds-success-subtle)" }} />
              </div>
              <p className="text-sm font-semibold text-foreground">Saved on this device only</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No ticket was created. Share this request with your admin or support outside the app.
              </p>
              <Button className="mt-2 cursor-pointer" onClick={onClose}>
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-name" className="text-xs font-medium text-foreground">
                    Name
                  </label>
                  <input
                    id="ri-name"
                    type="text"
                    required
                    placeholder="Your full name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-email" className="text-xs font-medium text-foreground">
                    Email
                  </label>
                  <input
                    id="ri-email"
                    type="email"
                    required
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-integration" className="text-xs font-medium text-foreground">
                    Integration name
                  </label>
                  <input
                    id="ri-integration"
                    type="text"
                    required
                    placeholder="e.g. Salesforce, Slack..."
                    value={form.integration}
                    onChange={(e) => setForm((f) => ({ ...f, integration: e.target.value }))}
                    className="h-9 px-3 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="ri-use-case" className="text-xs font-medium text-foreground">
                    Use case <span className="text-muted-foreground font-normal">(optional)</span>
                  </label>
                  <textarea
                    id="ri-use-case"
                    rows={3}
                    placeholder="Describe how you'd use this integration..."
                    value={form.useCase}
                    onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))}
                    className="px-3 py-2 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-foreground placeholder:text-muted-foreground resize-none leading-relaxed"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full cursor-pointer">
                Continue (local preview)
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { apiFeaturesAllowed } = useBillingAccess()
  const [interestModal, setInterestModal] = useState<{ name: string } | null>(null)
  const [requestModal, setRequestModal] = useState(false)

  const featured = MARKETING_INTEGRATION_CATALOG.find((e) => e.featured)

  return (
    <div className="flex flex-col gap-6">
      {!apiFeaturesAllowed && (
        <div className="rounded-lg border border-muted px-4 py-3 text-sm text-muted-foreground bg-secondary/30">
          <span className="font-medium text-foreground">Plan note: </span>
          Future <strong className="text-foreground">developer API keys</strong> and related Scale entitlements are separate
          from product connectors. <strong className="text-foreground">QuickBooks</strong> and{" "}
          <strong className="text-foreground">billing</strong> are configured under Settings regardless of API access.{" "}
          <Link href="/settings/billing" className="font-medium text-foreground underline-offset-2 hover:underline">
            View billing
          </Link>
        </div>
      )}

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
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
            What is live in Equipify today vs planned. Use Settings → Integrations for QuickBooks; Billing for Stripe
            Checkout.
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

      {featured ? <FuzorFeaturedCard entry={featured} /> : null}

      {MARKETING_INTEGRATION_CATEGORIES.map((category) => {
        const items = MARKETING_INTEGRATION_CATALOG.filter((i) => i.category === category && !i.featured)
        if (items.length === 0) return null
        return (
          <section key={category} className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-foreground">{category}</h2>
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">
                {items.length} integration{items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map((entry) => (
                <CatalogCard
                  key={entry.id}
                  entry={entry}
                  onInterest={(name) => setInterestModal({ name })}
                />
              ))}
            </div>
          </section>
        )
      })}

      {interestModal ? (
        <InterestModal integrationName={interestModal.name} onClose={() => setInterestModal(null)} />
      ) : null}

      {requestModal ? <RequestIntegrationModal onClose={() => setRequestModal(false)} /> : null}
    </div>
  )
}
