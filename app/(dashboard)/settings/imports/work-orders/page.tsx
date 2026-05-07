"use client"

import { CsvImportFlow } from "@/components/migration/csv-import-flow"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import Link from "next/link"
import { Shield } from "lucide-react"

export default function ImportWorkOrdersPage() {
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
      kind="work_order"
      backHref="/settings/imports"
      title="Import service history"
      description="Creates work orders linked to existing customers and equipment (match equipment serial per customer). Technician names are stored in notes when no user match exists."
    />
  )
}
