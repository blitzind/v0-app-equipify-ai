"use client"

import Link from "next/link"
import { ArrowLeft, FileArchive, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useOrgPermissions } from "@/lib/org-permissions-context"

export default function CertificatesImportPage() {
  const { has, status } = useOrgPermissions()
  const allowed = has("canManageHistoricalImports")

  if (status === "loading") return null

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
    <div className="flex flex-col gap-6 max-w-2xl">
      <Button variant="ghost" size="sm" asChild className="gap-1 -ml-2 self-start">
        <Link href="/settings/imports">
          <ArrowLeft className="h-4 w-4" />
          Migration center
        </Link>
      </Button>
      <div>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <FileArchive className="h-6 w-6 text-primary" />
          Certificates & compliance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bulk PDF/ZIP matching and calibration record linking share the same job pipeline as other imports. Phase 1
          establishes secure storage and audit hooks — attach certificates to equipment from the equipment detail view
          until automated ZIP ingestion ships.
        </p>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-muted/20 p-6 space-y-2">
        <p className="text-sm font-medium text-foreground">Next phase</p>
        <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
          <li>ZIP extract + filename → serial / WO matching</li>
          <li>Optional CSV manifest beside uploaded PDFs</li>
          <li>Queued processing with larger file limits</li>
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        Existing calibration records remain tied to work orders — historical imports should create or reference completed
        work orders before attaching certificates.
      </p>
    </div>
  )
}
