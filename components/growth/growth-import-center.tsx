"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GrowthBadge } from "@/components/growth/growth-ui-utils"
import { GROWTH_SEAMLESS_EXPORT_TYPES } from "@/lib/growth/import/constants"
import type { GrowthImportBatch } from "@/lib/growth/import/types"

function statusTone(status: GrowthImportBatch["status"]) {
  switch (status) {
    case "completed":
      return "healthy" as const
    case "running":
      return "medium" as const
    case "failed":
      return "critical" as const
    case "cancelled":
      return "stalled" as const
    default:
      return "attention" as const
  }
}

type ImportVendorOption = {
  vendorKey: string
  vendorName: string
  uiEnabled: boolean
}

type GrowthImportCenterProps = {
  onUploaded?: (batchId: string) => void
}

export function GrowthImportCenter({ onUploaded }: GrowthImportCenterProps) {
  const [batches, setBatches] = useState<GrowthImportBatch[]>([])
  const [vendors, setVendors] = useState<ImportVendorOption[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [batchName, setBatchName] = useState("")
  const [sourceVendor, setSourceVendor] = useState("manual_csv")
  const [seamlessExportType, setSeamlessExportType] = useState<(typeof GROWTH_SEAMLESS_EXPORT_TYPES)[number]>("clean")
  const [sourceChannel, setSourceChannel] = useState("")
  const [sourceCampaign, setSourceCampaign] = useState("")
  const [file, setFile] = useState<File | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [batchRes, vendorRes] = await Promise.all([
        fetch("/api/platform/growth/import-batches", { cache: "no-store" }),
        fetch("/api/platform/growth/import-vendors", { cache: "no-store" }),
      ])
      const data = (await batchRes.json().catch(() => ({}))) as {
        ok?: boolean
        batches?: GrowthImportBatch[]
        message?: string
        error?: string
      }
      const vendorData = (await vendorRes.json().catch(() => ({}))) as {
        ok?: boolean
        vendors?: ImportVendorOption[]
      }
      if (!batchRes.ok || !data.ok) throw new Error(data.message ?? data.error ?? "Could not load import batches.")
      setBatches(data.batches ?? [])
      const enabled = (vendorData.vendors ?? []).filter((vendor) => vendor.uiEnabled)
      setVendors(enabled)
      setSourceVendor((current) => {
        if (enabled.length === 0) return current
        return enabled.some((vendor) => vendor.vendorKey === current) ? current : enabled[0]!.vendorKey
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load import batches.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleUpload() {
    if (!file || !batchName.trim()) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("batchName", batchName.trim())
      form.append("sourceVendor", sourceVendor)
      if (sourceVendor === "seamless") form.append("seamlessExportType", seamlessExportType)
      if (sourceChannel.trim()) form.append("sourceChannel", sourceChannel.trim())
      if (sourceCampaign.trim()) form.append("sourceCampaign", sourceCampaign.trim())

      const res = await fetch("/api/platform/growth/import-batches", { method: "POST", body: form })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        batch?: GrowthImportBatch
        message?: string
        error?: string
      }
      if (!res.ok || !data.ok || !data.batch) {
        throw new Error(data.message ?? data.error ?? "Upload failed.")
      }
      setBatchName("")
      setSourceChannel("")
      setSourceCampaign("")
      setFile(null)
      onUploaded?.(data.batch.id)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.")
    } finally {
      setUploading(false)
    }
  }

  const selectedVendor = vendors.find((vendor) => vendor.vendorKey === sourceVendor)

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Upload CSV</h2>
        <p className="mt-1 text-sm text-muted-foreground">Manual CSV or Seamless export — up to 5,000 rows per batch.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="batch-name">Batch name</Label>
            <Input id="batch-name" value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="Q1 HVAC prospects" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-vendor">Import vendor</Label>
            <select
              id="source-vendor"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={sourceVendor}
              onChange={(e) => setSourceVendor(e.target.value)}
            >
              {vendors.map((vendor) => (
                <option key={vendor.vendorKey} value={vendor.vendorKey}>
                  {vendor.vendorName}
                </option>
              ))}
            </select>
          </div>
          {sourceVendor === "seamless" ? (
            <div className="space-y-2">
              <Label htmlFor="seamless-export-type">Seamless export type</Label>
              <select
                id="seamless-export-type"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                value={seamlessExportType}
                onChange={(e) => setSeamlessExportType(e.target.value as (typeof GROWTH_SEAMLESS_EXPORT_TYPES)[number])}
              >
                {GROWTH_SEAMLESS_EXPORT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="source-channel">Source channel</Label>
              <Input id="source-channel" value={sourceChannel} onChange={(e) => setSourceChannel(e.target.value)} placeholder="Outbound" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="source-campaign">Source campaign</Label>
            <Input id="source-campaign" value={sourceCampaign} onChange={(e) => setSourceCampaign(e.target.value)} placeholder="Spring 2026" />
          </div>
          {sourceVendor === "seamless" ? (
            <div className="space-y-2">
              <Label htmlFor="source-channel-seamless">Source channel</Label>
              <Input
                id="source-channel-seamless"
                value={sourceChannel}
                onChange={(e) => setSourceChannel(e.target.value)}
                placeholder="Seamless"
              />
            </div>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="csv-file">CSV file</Label>
            <Input id="csv-file" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {selectedVendor ? (
              <p className="text-xs text-muted-foreground">Adapter: {selectedVendor.vendorName}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <Button disabled={uploading || !file || !batchName.trim()} onClick={() => void handleUpload()}>
            {uploading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
            Upload & preview
          </Button>
        </div>
      </section>

      {error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Batch history</h2>
        </div>
        {loading ? (
          <div className="flex items-center px-5 py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Loading batches…
          </div>
        ) : batches.length === 0 ? (
          <div className="px-5 py-8 text-sm text-muted-foreground">No import batches yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Batch</th>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Rows</th>
                  <th className="px-4 py-3 font-medium">Results</th>
                  <th className="px-4 py-3 font-medium">Quality</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Link href={`/admin/growth/imports/${batch.id}`} className="font-medium hover:underline">
                        {batch.batchName}
                      </Link>
                      {batch.fileName ? <div className="text-xs text-muted-foreground">{batch.fileName}</div> : null}
                    </td>
                    <td className="px-4 py-3 capitalize">{batch.sourceVendor.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 tabular-nums">{batch.rowCount}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {batch.importedCount} new · {batch.updatedCount} merged · {batch.duplicateCount} dup · {batch.errorCount} err
                    </td>
                    <td className="px-4 py-3 tabular-nums">{batch.importQualityScore ?? "—"}</td>
                    <td className="px-4 py-3">
                      <GrowthBadge label={batch.status} tone={statusTone(batch.status)} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(batch.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
