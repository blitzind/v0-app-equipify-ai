"use client"

import { CsvImportFlow } from "@/components/migration/csv-import-flow"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import Link from "next/link"
import { Shield } from "lucide-react"

export default function ImportInvoicesPage() {
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
          Only owners and admins can run imports.{" "}
          <Link href="/settings/imports" className="text-primary underline">
            Back to Migration center
          </Link>
        </p>
      </div>
    )
  }

  return (
    <CsvImportFlow
      kind="invoice"
      backHref="/settings/imports"
      title="Import historical invoices"
      description="Preserves invoice numbers, dates, amounts, and customer linkage for operational history. QuickBooks auto-sync is not triggered for these rows."
    />
  )
}
