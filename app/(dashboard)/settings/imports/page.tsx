"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  ClipboardList,
  FileSpreadsheet,
  GraduationCap,
  Loader2,
  Plug,
  Shield,
  Upload,
  Users,
  Wrench,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import { IMPORT_STRATEGIES } from "@/lib/migration-imports/strategy"

type ImportJobListItem = {
  jobId: string
  importRef: string
  kind: string
  source_system?: string | null
  status: string
  file_name: string | null
  row_count: number | null
  processed_count?: number | null
  success_count: number | null
  error_count: number | null
  skipped_count?: number | null
  updated_count?: number | null
  strategy?: string | null
  active_run_id?: string | null
  cancel_requested_at?: string | null
  uploaded_by?: string | null
  created_at: string | null
  completed_at: string | null
  source_type?: string | null
  processing_duration_ms?: number | null
  user_message: string | null
}

function listStrategyLabel(value: string | null | undefined): string {
  if (!value) return "—"
  const hit = IMPORT_STRATEGIES.find((s) => s.value === value)
  return hit?.label ?? value.replace(/_/g, " ")
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—"
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
}

function statusBadgeClass(status: string): string {
  if (status === "completed") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (status === "completed_with_errors") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
  if (status === "failed" || status === "cancelled") return "border-destructive/30 bg-destructive/10 text-destructive"
  if (status === "processing" || status === "queued") return "border-primary/30 bg-primary/10 text-primary"
  return "border-border bg-muted/40 text-muted-foreground"
}

function HubCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-lg border border-border bg-card p-5 flex flex-col gap-2 transition-colors",
        "hover:border-primary/40 hover:bg-primary/[0.03]",
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary shrink-0" aria-hidden />
        <h2 className="font-semibold text-foreground">{title}</h2>
        <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </Link>
  )
}

export default function MigrationCenterPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { has, status: permStatus } = useOrgPermissions()
  const allowed = has("canManageHistoricalImports")

  const [jobs, setJobs] = useState<ImportJobListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadJobs = useCallback(async () => {
    if (!organizationId || !allowed) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports`)
      const json = (await res.json()) as { jobs?: ImportJobListItem[]; message?: string }
      if (!res.ok) {
        setError(json.message ?? "Could not load import history.")
        setJobs([])
        return
      }
      setJobs(json.jobs ?? [])
    } catch {
      setError("Could not load import history.")
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, allowed])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  if (permStatus === "loading" || orgStatus !== "ready") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Shield className="h-5 w-5 text-primary" />
          Migration center
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Only workspace owners and admins can access historical migration tools. Your role does not include this
          permission.
        </p>
      </div>
    )
  }

  const recentImports = jobs.length
  const lastJob = jobs[0]

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Migration center</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Import legacy customers, equipment, invoices, and service history with preview and validation. Nothing is
          written until you confirm the import. QuickBooks live sync remains under Integrations — this area focuses on
          operational continuity and historical records.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent activity</p>
          <p className="text-2xl font-semibold text-foreground mt-1">{recentImports}</p>
          <p className="text-xs text-muted-foreground mt-0.5">import batches (last 50 shown)</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Latest batch</p>
          <p className="text-sm font-medium text-foreground mt-1">
            {lastJob ? (
              <>
                <span className="font-mono text-primary">{lastJob.importRef}</span> · {lastJob.kind.replace(/_/g, " ")} ·{" "}
                {lastJob.status.replace(/_/g, " ")}
              </>
            ) : (
              <span className="text-muted-foreground">No imports yet</span>
            )}
          </p>
          {lastJob?.user_message ? (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lastJob.user_message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <HubCard
          href="/settings/imports/customers"
          icon={Users}
          title="Customers"
          description="Accounts, contacts, service locations, portal-ready emails. Duplicate detection by external code and company name."
        />
        <HubCard
          href="/settings/imports/equipment"
          icon={Wrench}
          title="Equipment"
          description="Serial numbers, manufacturer, PM/calibration dates, customer linkage."
        />
        <HubCard
          href="/settings/imports/invoices"
          icon={FileSpreadsheet}
          title="Historical invoices"
          description="Operational invoice history — amounts, dates, status, customer linkage. Does not replace accounting."
        />
        <HubCard
          href="/settings/imports/work-orders"
          icon={ClipboardList}
          title="Service history"
          description="Completed work orders with equipment and customer references for timelines."
        />
        <HubCard
          href="/settings/imports/certificates"
          icon={GraduationCap}
          title="Certificates & compliance"
          description="Bulk documentation workflows — ZIP matching is staged for a later phase."
        />
        <HubCard
          href="/settings/imports/fieldpulse"
          icon={Briefcase}
          title="FieldPulse exports"
          description="CSV migration path for FieldPulse customers, equipment, jobs, appointments, and invoices."
        />
        <HubCard
          href="/settings/imports/quickbooks"
          icon={Plug}
          title="QuickBooks continuity"
          description="Import historical QuickBooks data without modifying QuickBooks or outbound sync settings."
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-foreground">Manufacturer catalog</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Price list PDF imports stay under Catalog — they use a separate AI extraction pipeline.
        </p>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/catalog/import">
            Open catalog import <Upload className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-foreground">Import history</h2>
          <Button variant="ghost" size="sm" onClick={() => void loadJobs()} disabled={loading}>
            Refresh
          </Button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading jobs…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No import jobs yet.</p>
        ) : (
          <div className="ds-table-surface">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ref</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kind</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Strategy</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Rows</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Counts</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Uploaded</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Summary</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.jobId} className="border-b border-border/80 last:border-0">
                    <td className="px-3 py-2 font-mono text-primary">
                      <Link href={`/settings/imports/${j.jobId}`} className="hover:underline">
                        {j.importRef}
                      </Link>
                    </td>
                    <td className="px-3 py-2 capitalize">{j.kind.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2">
                      <span className={cn("capitalize inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", statusBadgeClass(j.status))}>
                        {j.status === "completed_with_errors" ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" aria-label="Completed with errors" />
                        ) : null}
                        {j.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{listStrategyLabel(j.strategy)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{j.row_count ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                      {j.success_count != null || j.updated_count != null || j.skipped_count != null ? (
                        <>
                          {j.success_count != null ? <span>cr {j.success_count}</span> : null}
                          {j.updated_count != null && j.updated_count > 0 ? (
                            <span className="ml-1">· up {j.updated_count}</span>
                          ) : null}
                          {j.skipped_count != null && j.skipped_count > 0 ? (
                            <span className="ml-1">· sk {j.skipped_count}</span>
                          ) : null}
                          {j.error_count != null && j.error_count > 0 ? (
                            <span className="ml-1 text-destructive">· err {j.error_count}</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      <div className="max-w-[160px]">
                        <p className="truncate">{j.uploaded_by ?? "—"}</p>
                        <p>
                          {j.created_at ? new Date(j.created_at).toLocaleDateString() : "—"}
                          {j.source_type ? ` · ${j.source_type.toUpperCase()}` : ""}
                        </p>
                        <p>Duration {formatDuration(j.processing_duration_ms)}</p>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs max-w-[200px] truncate">
                      {j.status === "processing" || j.status === "queued"
                        ? `progress ${(j.processed_count ?? 0).toLocaleString()} / ${(j.row_count ?? 0).toLocaleString()}${j.cancel_requested_at ? " · cancel requested" : ""}`
                        : j.user_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        CSV and XLSX imports use the same async-safe migration foundation. Open any import ref to review row outcomes,
        download errors, or retry failed rows in a later pass.
      </p>
    </div>
  )
}
