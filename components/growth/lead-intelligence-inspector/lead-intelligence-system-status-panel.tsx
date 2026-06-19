"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, CircleDot } from "lucide-react"
import { GROWTH_BUYING_STAGE_QA_MARKER } from "@/lib/growth/buying-stage/buying-stage-types"
import { GROWTH_CONTACT_DISCOVERY_QA_MARKER } from "@/lib/growth/contact-discovery/contact-discovery-types"
import { GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER } from "@/lib/growth/enrichment/enrichment-types"
import { GROWTH_INTENT_PIXEL_LIVE_QA_MARKER } from "@/lib/growth/intent-pixel/intent-pixel-admin-types"
import {
  GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER,
  type LeadIntelligenceSystemStatusRow,
} from "@/lib/growth/lead-engine/lead-intelligence-inspector-types"
import { GROWTH_PROVIDER_CACHE_QA_MARKER } from "@/lib/growth/provider-cache/provider-cache-types"
import { GROWTH_PROSPECT_SEARCH_QA_MARKER } from "@/lib/growth/prospect-search/prospect-search-types"
import { growthProspectSearchHref } from "@/lib/growth/navigation/growth-prospect-search-paths"
import { GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER } from "@/lib/growth/real-world-discovery/real-world-discovery-types"
import type { GrowthLeadEnginePipelineRun } from "@/lib/growth/lead-engine/orchestrator/lead-engine-run-types"
import { cn } from "@/lib/utils"

const BASE_SYSTEM_ROWS: LeadIntelligenceSystemStatusRow[] = [
  {
    id: "intent_pixel",
    label: "Intent Pixel",
    status: "ready",
    detail: "Live visitor tracking active",
    href: "/admin/growth/intent-pixel",
    qaMarker: GROWTH_INTENT_PIXEL_LIVE_QA_MARKER,
  },
  {
    id: "prospect_discovery",
    label: "Prospect Discovery",
    status: "ready",
    detail: "Prospect Search index + filters",
    qaMarker: GROWTH_PROSPECT_SEARCH_QA_MARKER,
  },
  {
    id: "company_discovery",
    label: "Company Discovery",
    status: "fixture",
    detail: "Google Places + SERP providers (sample data when unconfigured)",
    qaMarker: GROWTH_REAL_WORLD_COMPANY_DISCOVERY_QA_MARKER,
  },
  {
    id: "contact_discovery",
    label: "Contact Discovery",
    status: "ready",
    detail: "Contact research bridge available",
    qaMarker: GROWTH_CONTACT_DISCOVERY_QA_MARKER,
  },
  {
    id: "buying_stage",
    label: "Buying Stage",
    status: "ready",
    detail: "Buying stage signals in search filters",
    qaMarker: GROWTH_BUYING_STAGE_QA_MARKER,
  },
  {
    id: "verification",
    label: "Verification",
    status: "ready",
    detail: "Verification triage in Lead Engine pipeline",
    qaMarker: GROWTH_VERIFICATION_ENRICHMENT_QA_MARKER,
  },
  {
    id: "provider_cache",
    label: "Provider Cache",
    status: "ready",
    detail: "Query cache for Google Places, SERP, directories",
    qaMarker: GROWTH_PROVIDER_CACHE_QA_MARKER,
  },
]

function statusLabel(status: LeadIntelligenceSystemStatusRow["status"]): string {
  if (status === "fixture") return "sample"
  return status
}

function statusTone(status: LeadIntelligenceSystemStatusRow["status"]): string {
  if (status === "ready") return "text-emerald-700 bg-emerald-50 border-emerald-200"
  if (status === "fixture") return "text-amber-800 bg-amber-50 border-amber-200"
  return "text-slate-600 bg-slate-50 border-slate-200"
}

function formatLastRun(run: GrowthLeadEnginePipelineRun | null): string {
  if (!run) return "—"
  return `${run.pipeline_status} · ${run.execution_duration_ms}ms · ${run.input.companyName}`
}

function formatProviderSpend(run: GrowthLeadEnginePipelineRun | null): string {
  if (!run) return "—"
  if (run.mode === "fixture_dry_run") return "$0.00 (sample pipeline)"
  return "—"
}

export function LeadIntelligenceSystemStatusPanel({
  run,
  className,
}: {
  run: GrowthLeadEnginePipelineRun | null
  className?: string
}) {
  const pathname = usePathname()
  const prospectSearchPath = growthProspectSearchHref(pathname)
  const rows = BASE_SYSTEM_ROWS.map((row) => {
    if (row.id === "prospect_discovery" || row.id === "company_discovery") {
      return { ...row, href: prospectSearchPath }
    }
    return row
  })

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-5 shadow-sm", className)}
      data-qa-marker={GROWTH_LEAD_INTELLIGENCE_INSPECTOR_QA_MARKER}
    >
      <div className="flex items-center gap-2">
        <Activity className="size-4 text-muted-foreground" />
        <h3 className="font-semibold">System status</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Growth subsystems available to operators — sample data mode when live keys are not configured.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{row.label}</p>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize",
                    statusTone(row.status),
                  )}
                >
                  {statusLabel(row.status)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
            </>
          )

          return row.href ? (
            <Link
              key={row.id}
              href={row.href}
              className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted/40"
            >
              {body}
            </Link>
          ) : (
            <div key={row.id} className="rounded-lg border border-border bg-background p-3">
              {body}
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CircleDot className="size-3.5 text-violet-600" />
            Provider spend
          </div>
          <p className="mt-1 text-sm">{formatProviderSpend(run)}</p>
        </div>
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CircleDot className="size-3.5 text-violet-600" />
            Last run
          </div>
          <p className="mt-1 text-sm">{formatLastRun(run)}</p>
        </div>
      </div>
    </section>
  )
}
