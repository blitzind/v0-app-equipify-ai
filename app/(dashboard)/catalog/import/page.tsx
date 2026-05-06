"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Loader2, RefreshCw, Upload } from "lucide-react"
import { useActiveOrganization } from "@/lib/active-organization-context"
import type { DuplicateAction, ExtractedCatalogRow, StoredPriceListPayload } from "@/lib/catalog/import-types"
import { CATALOG_ITEM_TYPES } from "@/lib/catalog/import-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

export default function ImportPriceListPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { organizationId, status } = useActiveOrganization()

  const [manufacturerName, setManufacturerName] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [importId, setImportId] = useState<string | null>(null)
  const [payload, setPayload] = useState<StoredPriceListPayload | null>(null)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [extractBusy, setExtractBusy] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const [patchBusy, setPatchBusy] = useState(false)

  const [dupOpen, setDupOpen] = useState(false)
  const [dupConflicts, setDupConflicts] = useState<{ rowId: string; existingCatalogItemId: string }[]>([])
  const [dupChoices, setDupChoices] = useState<Record<string, DuplicateAction>>({})

  const updateRow = useCallback((id: string, patch: Partial<ExtractedCatalogRow>) => {
    setPayload((p) => {
      if (!p) return p
      return {
        ...p,
        rows: p.rows.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      }
    })
  }, [])

  const removeRow = useCallback((id: string) => {
    setPayload((p) => {
      if (!p) return p
      return { ...p, rows: p.rows.filter((r) => r.id !== id) }
    })
  }, [])

  const selectedRows = useMemo(() => (payload?.rows ?? []).filter((r) => r.selected), [payload])

  async function handleUploadAndExtract() {
    if (!organizationId || !file) {
      toast({ variant: "destructive", title: "Choose a PDF", description: "Select a price list file first." })
      return
    }
    setUploadBusy(true)
    try {
      const fd = new FormData()
      fd.set("file", file)
      if (manufacturerName.trim()) fd.set("manufacturerName", manufacturerName.trim())

      const res = await fetch(`/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports`, {
        method: "POST",
        body: fd,
      })
      const data = (await res.json()) as {
        ok?: boolean
        importId?: string
        payload?: StoredPriceListPayload
        message?: string
        error?: string
      }

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Upload / extraction failed",
          description: data.message ?? data.error ?? `Request failed (${res.status})`,
        })
        return
      }

      setImportId(data.importId ?? null)
      setPayload(data.payload ?? null)
      toast({ title: "Extracted", description: "Review rows below before saving." })
    } catch {
      toast({ variant: "destructive", title: "Network error", description: "Try again." })
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleReExtract() {
    if (!organizationId || !importId) return
    setExtractBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/extract`,
        { method: "POST" },
      )
      const data = (await res.json()) as { ok?: boolean; payload?: StoredPriceListPayload; message?: string; error?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Re-extract failed",
          description: data.message ?? data.error ?? `Failed (${res.status})`,
        })
        return
      }
      setPayload(data.payload ?? null)
      toast({ title: "Re-extracted", description: "Review updated rows." })
    } catch {
      toast({ variant: "destructive", title: "Network error" })
    } finally {
      setExtractBusy(false)
    }
  }

  async function handleApplyEdits() {
    if (!organizationId || !importId || !payload) return
    setPatchBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payload }),
        },
      )
      const data = (await res.json()) as { ok?: boolean; message?: string }
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Could not save edits",
          description: data.message ?? `Failed (${res.status})`,
        })
        return
      }
      toast({ title: "Draft saved", description: "Edits stored on this import." })
    } catch {
      toast({ variant: "destructive", title: "Network error" })
    } finally {
      setPatchBusy(false)
    }
  }

  async function runDuplicatePreviewThenCommit() {
    if (!organizationId || !importId || !payload || selectedRows.length === 0) {
      toast({
        variant: "destructive",
        title: "Nothing selected",
        description: "Select at least one row to save.",
      })
      return
    }

    setSaveBusy(true)
    try {
      const previewRes = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/duplicate-preview`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rowIds: selectedRows.map((r) => r.id) }),
        },
      )
      const previewJson = (await previewRes.json()) as {
        conflicts?: { rowId: string; existingCatalogItemId: string }[]
      }

      if (!previewRes.ok) {
        toast({
          variant: "destructive",
          title: "Duplicate check failed",
          description: "Could not verify duplicates.",
        })
        return
      }

      const conflicts = previewJson.conflicts ?? []
      if (conflicts.length > 0) {
        const init: Record<string, DuplicateAction> = {}
        conflicts.forEach((c) => {
          init[c.rowId] = "skip"
        })
        setDupChoices(init)
        setDupConflicts(conflicts)
        setDupOpen(true)
        return
      }

      await commitRows(
        selectedRows.map((r) => ({
          rowId: r.id,
          duplicateAction: "create" as const,
        })),
      )
    } finally {
      setSaveBusy(false)
    }
  }

  async function commitRows(commits: { rowId: string; duplicateAction: DuplicateAction; existingCatalogItemId?: string }[]) {
    if (!organizationId || !importId) return
    setSaveBusy(true)
    try {
      const res = await fetch(
        `/api/organizations/${encodeURIComponent(organizationId)}/price-list-imports/${encodeURIComponent(importId)}/commit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commits }),
        },
      )
      const data = (await res.json()) as {
        ok?: boolean
        saved?: number
        skipped?: number
        errors?: string[]
      }

      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Save failed",
          description: data.errors?.[0] ?? `HTTP ${res.status}`,
        })
        return
      }

      toast({
        title: data.ok ? "Catalog updated" : "Partial save",
        description: `Saved ${data.saved ?? 0}, skipped ${data.skipped ?? 0}.`,
      })

      if (data.errors?.length) {
        toast({
          variant: "destructive",
          title: "Some rows failed",
          description: data.errors.slice(0, 3).join(" · "),
        })
      }

      setDupOpen(false)
      if ((data.saved ?? 0) > 0) router.push("/catalog")
    } catch {
      toast({ variant: "destructive", title: "Network error" })
    } finally {
      setSaveBusy(false)
    }
  }

  function confirmDuplicatesAndCommit() {
    if (!payload) return

    const commits = selectedRows.map((r) => {
      const conflict = dupConflicts.find((c) => c.rowId === r.id)
      if (!conflict) {
        return { rowId: r.id, duplicateAction: "create" as const }
      }
      const action = dupChoices[conflict.rowId] ?? "skip"
      return {
        rowId: r.id,
        duplicateAction: action,
        existingCatalogItemId: action === "update" ? conflict.existingCatalogItemId : undefined,
      }
    })

    void commitRows(commits)
  }

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground py-16 justify-center">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading…
      </div>
    )
  }

  if (!organizationId) {
    return <p className="text-sm text-muted-foreground py-10">Select an organization.</p>
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1400px]">
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" asChild>
          <Link href="/catalog" aria-label="Back to catalog">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Import price list</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Upload a manufacturer or vendor price list and Equipify will extract equipment, parts, services, and pricing into your item catalog.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-4 py-3 flex gap-3 text-sm text-foreground">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium">Review before saving</p>
          <p className="text-muted-foreground mt-0.5">
            AI extraction can make mistakes—especially with dense manufacturer tables. Do not save until you have verified part numbers and prices.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 flex flex-col gap-4 max-w-xl">
        <div>
          <Label htmlFor="mfg">Manufacturer (optional hint)</Label>
          <Input
            id="mfg"
            value={manufacturerName}
            onChange={(e) => setManufacturerName(e.target.value)}
            placeholder="e.g. AMBCO"
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="pdf">Price list PDF</Label>
          <Input
            id="pdf"
            type="file"
            accept="application/pdf,.pdf"
            className="mt-1"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground mt-1">PDF only for MVP. CSV / Excel later.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            className="gap-2"
            disabled={uploadBusy || !file}
            onClick={() => void handleUploadAndExtract()}
          >
            {uploadBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload price list &amp; extract
          </Button>
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            disabled={extractBusy || !importId}
            onClick={() => void handleReExtract()}
          >
            {extractBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Re-run extraction
          </Button>
        </div>
      </div>

      {payload?.warnings?.length ? (
        <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
          {payload.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}

      {payload && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-foreground">
              Extracted rows ({payload.rows.length}) · manufacturer: {payload.manufacturerName ?? "—"} · effective:{" "}
              {payload.effectiveDate ?? "—"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={patchBusy} onClick={() => void handleApplyEdits()}>
                {patchBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save edits to draft
              </Button>
              <Button type="button" size="sm" disabled={saveBusy} onClick={() => void runDuplicatePreviewThenCommit()}>
                {saveBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Save selected items
              </Button>
              <Button type="button" variant="ghost" size="sm" asChild>
                <Link href="/catalog">Cancel</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="ds-table-header-row-subtle">
                  <TableHead className="w-10" />
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Conf.</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payload.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="align-top pt-3">
                      <Checkbox
                        checked={r.selected}
                        onCheckedChange={(v) => updateRow(r.id, { selected: v === true })}
                        aria-label={`Select ${r.name}`}
                      />
                    </TableCell>
                    <TableCell className="align-top min-w-[120px]">
                      <Input value={r.category} onChange={(e) => updateRow(r.id, { category: e.target.value })} className="h-8 text-xs" />
                    </TableCell>
                    <TableCell className="align-top min-w-[110px]">
                      <Select
                        value={r.itemType}
                        onValueChange={(v) =>
                          updateRow(r.id, { itemType: v as ExtractedCatalogRow["itemType"] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATALOG_ITEM_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top min-w-[100px]">
                      <Input
                        value={r.partNumber}
                        onChange={(e) => updateRow(r.id, { partNumber: e.target.value })}
                        className="h-8 text-xs font-mono"
                      />
                    </TableCell>
                    <TableCell className="align-top min-w-[180px]">
                      <Input value={r.name} onChange={(e) => updateRow(r.id, { name: e.target.value })} className="h-8 text-xs" />
                    </TableCell>
                    <TableCell className="align-top w-[88px]">
                      <Input
                        inputMode="decimal"
                        value={r.listPrice ?? ""}
                        onChange={(e) => {
                          const t = e.target.value.trim()
                          if (t === "") {
                            updateRow(r.id, { listPrice: null })
                            return
                          }
                          const n = Number.parseFloat(t.replace(/,/g, ""))
                          updateRow(r.id, { listPrice: Number.isFinite(n) ? n : null })
                        }}
                        className="h-8 text-xs tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="align-top w-[88px]">
                      <Input
                        inputMode="decimal"
                        value={r.cost ?? ""}
                        onChange={(e) => {
                          const t = e.target.value.trim()
                          if (t === "") {
                            updateRow(r.id, { cost: null })
                            return
                          }
                          const n = Number.parseFloat(t.replace(/,/g, ""))
                          updateRow(r.id, { cost: Number.isFinite(n) ? n : null })
                        }}
                        className="h-8 text-xs tabular-nums"
                      />
                    </TableCell>
                    <TableCell className="align-top min-w-[110px]">
                      <Select
                        value={r.status}
                        onValueChange={(v) =>
                          updateRow(r.id, { status: v as ExtractedCatalogRow["status"] })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">active</SelectItem>
                          <SelectItem value="inactive">inactive</SelectItem>
                          <SelectItem value="discontinued">discontinued</SelectItem>
                          <SelectItem value="needs_review">needs_review</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="align-top min-w-[140px]">
                      <Input
                        value={r.notes ?? ""}
                        onChange={(e) => updateRow(r.id, { notes: e.target.value || null })}
                        className="h-8 text-xs"
                      />
                    </TableCell>
                    <TableCell className="align-top text-xs text-muted-foreground tabular-nums">
                      {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="align-top">
                      <Button type="button" variant="ghost" size="sm" className="text-destructive h-8 px-2" onClick={() => removeRow(r.id)}>
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={dupOpen} onOpenChange={setDupOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Possible duplicates</DialogTitle>
            <DialogDescription>
              Some selected rows match existing catalog items by part number / name and manufacturer. Choose how to handle each.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 max-h-[320px] overflow-y-auto pr-1">
            {dupConflicts.map((c) => {
              const row = payload?.rows.find((r) => r.id === c.rowId)
              const choice = dupChoices[c.rowId] ?? "skip"
              return (
                <div key={c.rowId} className="rounded-md border border-border p-3 space-y-2">
                  <p className="text-xs font-medium line-clamp-2">{row?.name ?? c.rowId}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">Existing ID: {c.existingCatalogItemId}</p>
                  <Select
                    value={choice}
                    onValueChange={(v) =>
                      setDupChoices((prev) => ({ ...prev, [c.rowId]: v as DuplicateAction }))
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">Skip (do not import)</SelectItem>
                      <SelectItem value="update">Update existing catalog row</SelectItem>
                      <SelectItem value="create">Create new anyway</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )
            })}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDupOpen(false)}>
              Back
            </Button>
            <Button type="button" onClick={() => confirmDuplicatesAndCommit()} disabled={saveBusy}>
              {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Confirm &amp; save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
