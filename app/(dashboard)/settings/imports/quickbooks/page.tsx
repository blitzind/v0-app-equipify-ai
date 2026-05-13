"use client"

import Link from "next/link"
import { useCallback, useMemo, useState } from "react"
import { ArrowLeft, Loader2, Plug, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { useToast } from "@/hooks/use-toast"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield } from "lucide-react"
import { IMPORT_STRATEGIES } from "@/lib/migration-imports/strategy"
import type { MigrationImportStrategy } from "@/lib/migration-imports/types"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type Entity = "customers" | "items" | "invoices"
type Preview = {
  strategy: MigrationImportStrategy
  dateRange: { start: string | null; end: string | null }
  breakdown: Record<Entity, { total: number; likelyNew: number; likelyMatched: number; likelySkipped: number; warnings: string[] }>
  warnings: string[]
  sample: Array<{ entity: Entity; label: string; status: string; reason: string }>
}

export default function QuickBooksMigrationPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { has, status: permStatus } = useOrgPermissions()
  const { toast } = useToast()
  const allowed = has("canManageHistoricalImports")
  const [busy, setBusy] = useState(false)
  const [commitBusy, setCommitBusy] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [entities, setEntities] = useState<Record<Entity, boolean>>({ customers: true, items: true, invoices: true })
  const [invoiceStartDate, setInvoiceStartDate] = useState("")
  const [invoiceEndDate, setInvoiceEndDate] = useState("")
  const [strategy, setStrategy] = useState<MigrationImportStrategy>("skip_duplicates")

  const selectedEntities = useMemo(
    () => (Object.entries(entities).filter(([, checked]) => checked).map(([key]) => key) as Entity[]),
    [entities],
  )

  const payload = useMemo(() => ({
    entities: selectedEntities,
    invoiceStartDate: invoiceStartDate || null,
    invoiceEndDate: invoiceEndDate || null,
    strategy,
  }), [invoiceEndDate, invoiceStartDate, selectedEntities, strategy])

  const runPreview = useCallback(async () => {
    if (!organizationId) return
    if (selectedEntities.length === 0) {
      toast({ title: "Choose at least one entity type", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/quickbooks/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { message?: string; preview?: Preview; jobId?: string }
      if (!res.ok) {
        toast({ title: "Preview failed", description: json.message ?? "QuickBooks request failed", variant: "destructive" })
        return
      }
      setPreview(json.preview ?? null)
      setJobId(json.jobId ?? null)
      toast({ title: "Preview ready", description: "QuickBooks was read only. Nothing has been imported yet." })
    } catch {
      toast({ title: "Request failed", variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }, [organizationId, payload, selectedEntities.length, toast])

  const runCommit = useCallback(async () => {
    if (!organizationId || !preview) return
    setCommitBusy(true)
    try {
      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/quickbooks/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, jobId }),
      })
      const json = (await res.json()) as { message?: string; jobId?: string; result?: { createdCount: number; updatedCount: number; skippedCount: number; errorCount: number } }
      if (!res.ok) {
        toast({ title: "Import failed", description: json.message ?? "QuickBooks import failed", variant: "destructive" })
        return
      }
      setJobId(json.jobId ?? jobId)
      toast({
        title: "QuickBooks import complete",
        description: `Created ${json.result?.createdCount ?? 0}, updated ${json.result?.updatedCount ?? 0}, skipped ${json.result?.skippedCount ?? 0}, errors ${json.result?.errorCount ?? 0}.`,
      })
    } catch {
      toast({ title: "Import failed", variant: "destructive" })
    } finally {
      setCommitBusy(false)
    }
  }, [jobId, organizationId, payload, preview, toast])

  if (permStatus === "loading" || orgStatus !== "ready") {
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!allowed) {
    return (
      <div className="max-w-lg rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 font-semibold text-foreground">
          <Shield className="h-5 w-5 text-primary" />
          Restricted
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          <Link href="/settings/imports" className="text-primary underline">
            Back to Migration center
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 self-start">
        <Link href="/settings/imports">
          <ArrowLeft className="h-4 w-4" />
          Migration center
        </Link>
      </Button>
      <div>
        <h1 className={cn(PAGE_STANDARD_PAGE_TITLE, "text-foreground flex items-center gap-2")}>
          <Plug className="h-6 w-6 text-primary" />
          QuickBooks continuity
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import historical QuickBooks data into Equipify. This reads from QuickBooks and will not modify QuickBooks or run
          outbound export sync.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div className="rounded-md border border-[color:var(--status-info)]/30 bg-[color:var(--status-info)]/10 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Import FROM QuickBooks:</span> bring past customers, items/services,
          and invoices into Equipify. This does not modify QuickBooks.
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {([
            ["customers", "Customers"],
            ["items", "Items / services"],
            ["invoices", "Invoices"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={entities[key]}
                onChange={(e) => setEntities((prev) => ({ ...prev, [key]: e.target.checked }))}
              />
              {label}
            </label>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="invoice-start">Invoice start date</Label>
            <Input id="invoice-start" type="date" value={invoiceStartDate} onChange={(e) => setInvoiceStartDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="invoice-end">Invoice end date</Label>
            <Input id="invoice-end" type="date" value={invoiceEndDate} onChange={(e) => setInvoiceEndDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="strategy">Strategy</Label>
            <select
              id="strategy"
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as MigrationImportStrategy)}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground"
            >
              {IMPORT_STRATEGIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </div>

        <Button type="button" onClick={() => void runPreview()} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Preview QuickBooks import
        </Button>
      </div>

      {preview ? (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 text-[color:var(--status-success)]" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Preview ready</h2>
              <p className="text-xs text-muted-foreground">Review counts before importing. QuickBooks has not been changed.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(preview.breakdown).map(([key, bucket]) => (
              <div key={key} className="rounded-md border border-border bg-background p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{key}</p>
                <p className="mt-1 text-2xl font-semibold text-foreground">{bucket.total}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New {bucket.likelyNew} · Matched {bucket.likelyMatched} · Skipped {bucket.likelySkipped}
                </p>
              </div>
            ))}
          </div>
          {preview.warnings.length ? (
            <div className="rounded-md border border-[color:var(--status-warning)]/30 bg-[color:var(--status-warning)]/10 px-3 py-2 text-xs text-[color:var(--status-warning)]">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              {preview.warnings.join(" ")}
            </div>
          ) : null}
          <div className="rounded-md border border-border divide-y divide-border overflow-hidden">
            {preview.sample.slice(0, 8).map((row, index) => (
              <div key={`${row.entity}-${row.label}-${index}`} className="grid gap-1 px-3 py-2 text-xs sm:grid-cols-[120px_1fr_100px]">
                <span className="font-medium text-muted-foreground">{row.entity}</span>
                <span className="text-foreground">{row.label}</span>
                <span className="text-muted-foreground">{row.status}</span>
              </div>
            ))}
          </div>
          <Button type="button" onClick={() => void runCommit()} disabled={commitBusy} className="gap-2">
            {commitBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Start historical import
          </Button>
        </div>
      ) : null}

      <Button asChild variant="outline">
        <Link href="/settings/integrations/quickbooks">Open QuickBooks integration</Link>
      </Button>
      {jobId ? (
        <Button asChild variant="ghost">
          <Link href={`/settings/imports/${jobId}`}>Open import details</Link>
        </Button>
      ) : null}
    </div>
  )
}
