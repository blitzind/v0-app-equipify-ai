"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ArrowDownUp,
  BarChart3,
  CheckCircle2,
  Info,
  Loader2,
  RefreshCw,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { GrowthBadge, GrowthEngineCard, StatTile } from "@/components/growth/growth-ui-utils"
import {
  APOLLO_OPERATIONS_DASHBOARD_QA_MARKER,
  type ApolloOperationsDashboardPayload,
  type ApolloOperationsRejectionRow,
} from "@/lib/growth/apollo/apollo-operations-dashboard-types"
import { cn } from "@/lib/utils"

type RejectionSortKey = "count" | "pct" | "label"

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—"
  return `${value}%`
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

function DiscoveryFunnelSection({
  funnel,
}: {
  funnel: ApolloOperationsDashboardPayload["discovery_funnel"]
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading
        title="Discovery funnel"
        description="Portfolio-level company progression — sourced from eligibility diagnostic."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Discovered" value={funnel.companies_discovered} icon={<BarChart3 size={14} />} />
        <StatTile label="Verified email" value={funnel.verified_email_companies} />
        <StatTile label="Sequence-ready" value={funnel.sequence_ready_companies} />
        <StatTile label="Qualified" value={funnel.qualified_companies} />
        <StatTile label="Greenfield" value={funnel.greenfield_available} />
        <StatTile label="Certified" value={funnel.certified_companies} />
      </div>
      <div className="space-y-2">
        {funnel.stages.map((stage) => (
          <div
            key={stage.key}
            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <span className="font-medium">{stage.label}</span>
            <span>{stage.count}</span>
            <span className="text-xs text-muted-foreground">
              {stage.conversion_pct != null ? `${stage.conversion_pct}% conversion` : "Trend: —"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RejectionAnalysisSection({
  rows,
  totalDiscovered,
}: {
  rows: ApolloOperationsRejectionRow[]
  totalDiscovered: number
}) {
  const [sortKey, setSortKey] = useState<RejectionSortKey>("count")
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortKey === "label") cmp = a.label.localeCompare(b.label)
      else if (sortKey === "pct") cmp = a.pct - b.pct
      else cmp = a.count - b.count
      return sortAsc ? cmp : -cmp
    })
    return copy
  }, [rows, sortAsc, sortKey])

  const toggleSort = (key: RejectionSortKey) => {
    if (sortKey === key) setSortAsc((value) => !value)
    else {
      setSortKey(key)
      setSortAsc(key === "label")
    }
  }

  const SortButton = ({ label, column }: { label: string; column: RejectionSortKey }) => (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium hover:text-foreground"
      onClick={() => toggleSort(column)}
    >
      {label}
      <ArrowDownUp className="size-3 opacity-60" />
    </button>
  )

  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading
        title="Rejection analysis"
        description={`Skip reasons across ${totalDiscovered} discovered companies.`}
      />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-2 py-2">
                <SortButton label="Reason" column="label" />
              </th>
              <th className="px-2 py-2">
                <SortButton label="Count" column="count" />
              </th>
              <th className="px-2 py-2">
                <SortButton label="%" column="pct" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.reason} className="border-b last:border-0">
                <td className="px-2 py-2">{row.label}</td>
                <td className="px-2 py-2 font-mono">{row.count}</td>
                <td className="px-2 py-2 font-mono">{formatPct(row.pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ContactFunnelSection({
  contact,
}: {
  contact: ApolloOperationsDashboardPayload["contact_funnel"]
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading title="Contact funnel" description="Apollo contact candidates and channel yield." />
      <div className="mb-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Contact candidates" value={contact.contact_candidates} />
        <StatTile label="Verified emails" value={contact.verified_emails} />
        <StatTile label="LinkedIn profiles" value={contact.linkedin_profiles} />
        <StatTile label="Phone numbers" value={contact.phone_numbers} />
      </div>
      <div className="mb-3 grid grid-cols-1 gap-2 text-xs text-muted-foreground md:grid-cols-3">
        <span>→ Verified email: {formatPct(contact.conversion.candidates_to_verified_email_pct)}</span>
        <span>→ LinkedIn: {formatPct(contact.conversion.candidates_to_linkedin_pct)}</span>
        <span>→ Phone: {formatPct(contact.conversion.candidates_to_phone_pct)}</span>
      </div>
      <div className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        <span>{contact.apollo_phone_note}</span>
      </div>
    </div>
  )
}

function CohortFunnelSection({
  cohortFunnel,
}: {
  cohortFunnel: ApolloOperationsDashboardPayload["cohort_funnel"]
}) {
  const { portfolio, cohorts } = cohortFunnel
  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading title="Cohort funnel" description="Multi-cohort enrollment and certification progression." />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Draft cohorts" value={portfolio.draft_cohorts} />
        <StatTile label="Enrolled" value={portfolio.enrolled_companies} />
        <StatTile label="Personalized" value={portfolio.personalized_ready_companies} />
        <StatTile label="Certified" value={portfolio.certified_companies} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-2 py-2">Cohort</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Companies</th>
              <th className="px-2 py-2">Enrolled</th>
              <th className="px-2 py-2">Personalized</th>
              <th className="px-2 py-2">Certified</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((row) => (
              <tr key={row.cohort_id} className="border-b last:border-0">
                <td className="px-2 py-2">
                  <div className="font-medium">{row.cohort_name}</div>
                  {row.is_primary_certified && (
                    <GrowthBadge tone="healthy" label="Primary certified" className="mt-1" />
                  )}
                </td>
                <td className="px-2 py-2">{row.status}</td>
                <td className="px-2 py-2">
                  {row.company_count}/{row.target_company_count}
                </td>
                <td className="px-2 py-2">{row.enrolled_count}</td>
                <td className="px-2 py-2">{row.personalized_ready_count}</td>
                <td className="px-2 py-2">
                  {row.certified == null ? "—" : row.certified ? "Yes" : "No"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CertificationStatusSection({
  status,
}: {
  status: ApolloOperationsDashboardPayload["certification_status"]
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading
        title="Certification status"
        description={
          status.cohort_name
            ? `Cohort: ${status.cohort_name}`
            : "Select a cohort to view certification details."
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Enrollment %" value={status.enrollment_ready_pct ?? "—"} />
        <StatTile label="Personalization %" value={status.personalization_ready_pct ?? "—"} />
        <StatTile
          label="Ready for launch"
          value={status.ready_for_launch == null ? "—" : status.ready_for_launch ? "Yes" : "No"}
        />
        <StatTile
          label="Certified"
          value={status.certified == null ? "—" : status.certified ? "Yes" : "No"}
          icon={
            status.certified ? (
              <CheckCircle2 className="size-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="size-4 text-amber-600" />
            )
          }
        />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-md border px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Fatal blockers</p>
          {status.fatal_blockers.length === 0 ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">None</p>
          ) : (
            <ul className="list-disc pl-4 text-sm">
              {status.fatal_blockers.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md border px-3 py-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Warnings</p>
          {status.warnings.length === 0 ? (
            <p className="text-sm text-muted-foreground">None</p>
          ) : (
            <ul className="list-disc pl-4 text-sm">
              {status.warnings.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function ExpansionReadinessSection({
  expansion,
}: {
  expansion: ApolloOperationsDashboardPayload["expansion_readiness"]
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading title="Expansion readiness" description="Greenfield availability for next cohort." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Greenfield available" value={expansion.greenfield_available} icon={<TrendingUp size={14} />} />
        <StatTile label="Current certified cohort" value={expansion.current_certified_cohort} />
        <StatTile label="Target cohort size" value={expansion.target_cohort_size} />
        <StatTile
          label="Needed for next 25-cohort"
          value={expansion.additional_companies_needed_for_next_25_cohort}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Greenfield gap to {expansion.target_cohort_size}-company target: {expansion.greenfield_gap_to_target}{" "}
        additional companies required via discovery.
      </p>
    </div>
  )
}

function CreditUtilizationSection({
  credits,
}: {
  credits: ApolloOperationsDashboardPayload["credit_utilization"]
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <SectionHeading
        title="Apollo credit utilization"
        description="Surfaces existing evidence only — no new credit tracking in this phase."
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile label="Credits available" value={credits.credits_available ?? "Not tracked"} />
        <StatTile label="Credits consumed" value={credits.credits_consumed ?? "Not tracked"} />
        <StatTile label="Tracking status" value={credits.tracking_status.replace(/_/g, " ")} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{credits.note}</p>
    </div>
  )
}

export function ApolloOperationsDashboardSections({
  cohortId,
  className,
}: {
  cohortId?: string
  className?: string
}) {
  const [dashboard, setDashboard] = useState<ApolloOperationsDashboardPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (cohortId) params.set("cohort_id", cohortId)
      const res = await fetch(`/api/platform/growth/apollo-operations-dashboard?${params}`, {
        cache: "no-store",
      })
      const json = (await res.json()) as {
        ok?: boolean
        dashboard?: ApolloOperationsDashboardPayload
        message?: string
      }
      if (!res.ok || !json.ok || !json.dashboard) {
        throw new Error(json.message ?? "Could not load Apollo operations dashboard.")
      }
      setDashboard(json.dashboard)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [cohortId])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  if (loading && !dashboard) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
        <Loader2 className="size-4 animate-spin" />
        Loading Apollo operations dashboard…
      </div>
    )
  }

  if (error && !dashboard) {
    return <p className={cn("text-sm text-destructive", className)}>{error}</p>
  }

  if (!dashboard) return null

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          QA marker: {APOLLO_OPERATIONS_DASHBOARD_QA_MARKER} · Updated{" "}
          {new Date(dashboard.computed_at).toLocaleString()}
        </p>
        <Button variant="outline" size="sm" onClick={() => void loadDashboard()} disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          Refresh
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <DiscoveryFunnelSection funnel={dashboard.discovery_funnel} />
      <RejectionAnalysisSection
        rows={dashboard.rejection_analysis}
        totalDiscovered={dashboard.discovery_funnel.companies_discovered}
      />
      <ContactFunnelSection contact={dashboard.contact_funnel} />
      <CohortFunnelSection cohortFunnel={dashboard.cohort_funnel} />
      <CertificationStatusSection status={dashboard.certification_status} />
      <ExpansionReadinessSection expansion={dashboard.expansion_readiness} />
      <CreditUtilizationSection credits={dashboard.credit_utilization} />
    </div>
  )
}
