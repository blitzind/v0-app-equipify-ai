"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
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

type ImportJobListItem = {
  jobId: string
  importRef: string
  kind: string
  status: string
  file_name: string | null
  row_count: number | null
  success_count: number | null
  error_count: number | null
  created_at: string | null
  completed_at: string | null
  user_message: string | null
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
          href="/settings/imports/quickbooks"
          icon={Plug}
          title="QuickBooks continuity"
          description="Record migration intent and jump to live QuickBooks integration settings."
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
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Ref</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Kind</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Status</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Rows</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Summary</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.jobId} className="border-b border-border/80 last:border-0">
                    <td className="px-3 py-2 font-mono text-primary">{j.importRef}</td>
                    <td className="px-3 py-2 capitalize">{j.kind.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 capitalize">{j.status.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {j.row_count ?? "—"}
                      {j.success_count != null ? (
                        <span className="text-muted-foreground text-xs block">
                          ok {j.success_count}
                          {j.error_count != null && j.error_count > 0 ? ` · err ${j.error_count}` : ""}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs max-w-[220px] truncate">
                      {j.user_message ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground border-t border-border pt-4">
        AI-assisted column mapping and async jobs are planned on top of this foundation. XLSX support can be added when a
        spreadsheet parser is introduced — CSV works everywhere today.
      </p>
    </div>
  )
}
