"use client"

import Link from "next/link"
import { useState } from "react"
import { ClipboardList, FileSpreadsheet, Shield, Users, Wrench } from "lucide-react"
import { CsvImportFlow } from "@/components/migration/csv-import-flow"
import { Button } from "@/components/ui/button"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"

type FieldPulseDataType = "customer" | "equipment" | "work_order" | "invoice" | "appointment"

const FIELD_PULSE_TYPES: Array<{
  value: FieldPulseDataType
  label: string
  icon: React.ElementType
  kind: "customer" | "equipment" | "work_order" | "invoice"
  title: string
  description: string
}> = [
  {
    value: "customer",
    label: "Customers",
    icon: Users,
    kind: "customer",
    title: "Import FieldPulse customers",
    description:
      "Use exported FieldPulse customer CSV files. FieldPulse IDs, contacts, billing/service addresses, and notes are preserved in the import audit trail.",
  },
  {
    value: "equipment",
    label: "Equipment / assets",
    icon: Wrench,
    kind: "equipment",
    title: "Import FieldPulse equipment",
    description:
      "Import assets and equipment, then link them to existing customers by FieldPulse customer ID, external ID, or exact company name.",
  },
  {
    value: "work_order",
    label: "Jobs / work orders",
    icon: ClipboardList,
    kind: "work_order",
    title: "Import FieldPulse jobs and work orders",
    description:
      "Create historical or active work orders from FieldPulse jobs. Completed jobs become service history; scheduled/open jobs retain scheduling fields where safe.",
  },
  {
    value: "appointment",
    label: "Appointments / schedule",
    icon: ClipboardList,
    kind: "work_order",
    title: "Import FieldPulse appointments",
    description:
      "Use FieldPulse appointment exports to create scheduled service records. Appointment IDs are preserved as source record IDs and duplicate future appointments can be skipped.",
  },
  {
    value: "invoice",
    label: "Invoices",
    icon: FileSpreadsheet,
    kind: "invoice",
    title: "Import FieldPulse historical invoices",
    description:
      "Preserve FieldPulse invoice numbers, totals, balances, dates, and status as historical Equipify invoices. Emails and QuickBooks export sync are not triggered.",
  },
]

export default function FieldPulseMigrationPage() {
  const { has, status } = useOrgPermissions()
  const allowed = has("canManageHistoricalImports")
  const [dataType, setDataType] = useState<FieldPulseDataType>("customer")

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

  const selected = FIELD_PULSE_TYPES.find((item) => item.value === dataType) ?? FIELD_PULSE_TYPES[0]

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-3xl rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={cn(PAGE_STANDARD_PAGE_TITLE, "text-foreground")}>Import historical FieldPulse data</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use exported CSV files from FieldPulse. This will not modify FieldPulse, send customer emails, trigger
              automations, or sync imported invoices to QuickBooks.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/imports">Migration center</Link>
          </Button>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {FIELD_PULSE_TYPES.map((item) => {
            const Icon = item.icon
            const active = item.value === dataType
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setDataType(item.value)}
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Icon className="mb-1 h-4 w-4" />
                {item.label}
              </button>
            )
          })}
        </div>
      </div>

      <CsvImportFlow
        key={selected.value}
        kind={selected.kind}
        backHref="/settings/imports/fieldpulse"
        title={selected.title}
        description={selected.description}
        defaultSourceSystem={`FieldPulse ${selected.label}`}
      />
    </div>
  )
}
