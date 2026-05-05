"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Search, RotateCcw, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgArchivePermissions } from "@/lib/use-org-archive-permissions"
import { PageShell } from "@/components/page-shell"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import {
  FILTER_OPTIONS,
  type ArchivedCenterFilter,
  type ArchivedCenterRow,
} from "@/lib/archived-center/types"

function fmtDate(iso: string) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function SettingsArchivedPage() {
  const { toast } = useToast()
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { canArchiveRestore } = useOrgArchivePermissions()

  const [searchInput, setSearchInput] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<ArchivedCenterFilter>("all")
  const [records, setRecords] = useState<ArchivedCenterRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [restoringKey, setRestoringKey] = useState<string | null>(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [searchInput])

  const loadRecords = useCallback(async () => {
    if (!organizationId || orgStatus !== "ready") return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        organizationId,
        q: debouncedSearch,
        type: typeFilter,
      })
      const res = await fetch(`/api/archived?${params.toString()}`, { cache: "no-store" })
      const json = (await res.json()) as { records?: ArchivedCenterRow[]; message?: string }
      if (!res.ok) {
        setError(json.message ?? "Could not load archived records.")
        setRecords([])
        return
      }
      setRecords(json.records ?? [])
    } catch {
      setError("Could not load archived records.")
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [organizationId, orgStatus, debouncedSearch, typeFilter])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  async function handleRestore(row: ArchivedCenterRow) {
    if (!organizationId) return
    const key = `${row.type}:${row.id}`
    setRestoringKey(key)
    try {
      const res = await fetch("/api/archived/restore", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          recordType: row.type,
          recordId: row.id,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not restore",
          description: json.message ?? "Try again or contact support.",
        })
        return
      }
      toast({
        title: "Record restored",
        description: `${row.title} is visible in active lists again.`,
      })
      await loadRecords()
    } finally {
      setRestoringKey(null)
    }
  }

  return (
    <PageShell>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          {canArchiveRestore
            ? "Archived rows stay hidden from active lists and dashboard totals. Restore brings them back immediately."
            : "You can browse archived items; only workspace owners, admins, and managers can restore them."}
        </p>
        <Card className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-border/80">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name, reason, type, or who archived…"
              className="pl-9"
              aria-label="Search archived records"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center shrink-0">
            <Select
              value={typeFilter}
              onValueChange={(v) => setTypeFilter(v as ArchivedCenterFilter)}
            >
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Record type" />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : null}

        <Card className="border-border/80 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="ds-table-header-row hover:bg-transparent dark:hover:bg-card">
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead>Name / title</TableHead>
                <TableHead className="w-[160px]">Archived date</TableHead>
                <TableHead className="w-[160px]">Archived by</TableHead>
                <TableHead className="min-w-[140px]">Reason</TableHead>
                <TableHead className="w-[200px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-sm py-10 text-center">
                    Loading archived records…
                  </TableCell>
                </TableRow>
              ) : records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-sm py-10 text-center">
                    No archived records match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((row) => {
                  const rk = `${row.type}:${row.id}`
                  const busy = restoringKey === rk
                  return (
                    <TableRow key={rk}>
                      <TableCell className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                        {row.typeLabel}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{row.title}</TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">{fmtDate(row.archivedAt)}</TableCell>
                      <TableCell className="text-muted-foreground">{row.archivedByLabel ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[240px] truncate" title={row.archiveReason ?? ""}>
                        {row.archiveReason?.trim() ? row.archiveReason : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={!canArchiveRestore || busy}
                            onClick={() => void handleRestore(row)}
                          >
                            <RotateCcw className={cn("w-3.5 h-3.5 mr-1", busy && "animate-spin")} />
                            Restore
                          </Button>
                          {row.detailHref ? (
                            <Button type="button" size="sm" variant="ghost" asChild>
                              <Link href={row.detailHref}>
                                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                                View
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </PageShell>
  )
}
