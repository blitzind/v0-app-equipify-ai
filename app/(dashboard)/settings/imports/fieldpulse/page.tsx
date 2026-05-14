"use client"

import Link from "next/link"
import { useState } from "react"
import {
  Calendar,
  ClipboardList,
  Download,
  FileSpreadsheet,
  FileText,
  Shield,
  Users,
  Wrench,
} from "lucide-react"
import { CsvImportFlow } from "@/components/migration/csv-import-flow"
import { Button } from "@/components/ui/button"
import { useActiveOrganization } from "@/lib/active-organization-context"
import { useOrgPermissions } from "@/lib/org-permissions-context"
import { cn } from "@/lib/utils"
import { PAGE_STANDARD_PAGE_TITLE } from "@/lib/page-hero-tokens"
import type { CsvTemplateDownloadKind } from "@/lib/migration-imports/csv-templates"

type FieldPulseDataType = "customer" | "equipment" | "work_order" | "appointment" | "invoice" | "quote"

type FieldPulseImportKind = "customer" | "equipment" | "work_order" | "invoice" | "quote"

const FIELD_PULSE_TYPES: Array<{
  value: FieldPulseDataType
  label: string
  icon: React.ElementType
  kind: FieldPulseImportKind
  templateKind: CsvTemplateDownloadKind
  title: string
  description: string
}> = [
  {
    value: "customer",
    label: "Customers",
    icon: Users,
    kind: "customer",
    templateKind: "customer",
    title: "Import FieldPulse customers",
    description:
      "Use exported FieldPulse customer CSV files. FieldPulse IDs, contacts, billing/service addresses, optional parent_account (parent external ID or parent company name), and notes are preserved in the import audit trail.",
  },
  {
    value: "equipment",
    label: "Equipment / assets",
    icon: Wrench,
    kind: "equipment",
    templateKind: "equipment",
    title: "Import FieldPulse equipment",
    description:
      "Import assets and equipment, then link them to existing customers by FieldPulse customer ID, external ID, or exact company name.",
  },
  {
    value: "work_order",
    label: "Jobs / work orders",
    icon: ClipboardList,
    kind: "work_order",
    templateKind: "work_order",
    title: "Import FieldPulse jobs and work orders",
    description:
      "Create historical or active work orders from FieldPulse jobs. Completed jobs become service history; scheduled/open jobs retain scheduling fields where safe.",
  },
  {
    value: "appointment",
    label: "Appointments / schedule",
    icon: Calendar,
    kind: "work_order",
    templateKind: "appointment",
    title: "Import FieldPulse appointments",
    description:
      "Use FieldPulse appointment exports to create scheduled service records. Appointment IDs are preserved as source record IDs and duplicate future appointments can be skipped.",
  },
  {
    value: "invoice",
    label: "Invoices",
    icon: FileSpreadsheet,
    kind: "invoice",
    templateKind: "invoice",
    title: "Import FieldPulse historical invoices",
    description:
      "Preserve FieldPulse invoice numbers, totals, balances, dates, and status as historical Equipify invoices. Emails and QuickBooks export sync are not triggered.",
  },
  {
    value: "quote",
    label: "Quotes",
    icon: FileText,
    kind: "quote",
    templateKind: "quote",
    title: "Import FieldPulse quotes",
    description:
      "Normalize quote and estimate exports with the Equipify template, then preview mapping. Quote row commits are staged for a follow-up release — templates are ready today.",
  },
]

export default function FieldPulseMigrationPage() {
  const { organizationId, status: orgStatus } = useActiveOrganization()
  const { has, status } = useOrgPermissions()
  const allowed = has("canManageHistoricalImports")
  const [dataType, setDataType] = useState<FieldPulseDataType>("customer")

  if (status === "loading" || orgStatus === "loading") return null

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

  const templateHrefFor = (templateKind: CsvTemplateDownloadKind) =>
    organizationId
      ? `/api/organizations/${encodeURIComponent(organizationId)}/migration-imports/templates/${encodeURIComponent(templateKind)}`
      : null

  return (
    <div className="flex flex-col gap-6">
      <div className="max-w-5xl rounded-lg border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className={cn(PAGE_STANDARD_PAGE_TITLE, "text-foreground")}>Import historical FieldPulse data</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Use exported CSV files from FieldPulse. This will not modify FieldPulse, send customer emails, trigger
              automations, or sync imported invoices to QuickBooks.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Download a template, match your exported FieldPulse columns to Equipify&apos;s fields, then upload the cleaned
              CSV for preview.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/settings/imports">Migration center</Link>
          </Button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {FIELD_PULSE_TYPES.map((item) => {
            const Icon = item.icon
            const active = item.value === dataType
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setDataType(item.value)}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-left text-sm transition-colors flex flex-col gap-1.5 min-h-[7.5rem]",
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className="font-medium leading-snug">{item.label}</span>
                {organizationId ? (
                  <a
                    href={templateHrefFor(item.templateKind)}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "mt-auto inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline",
                      active ? "text-primary" : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Download className="h-3 w-3 shrink-0" aria-hidden />
                    Download CSV template
                  </a>
                ) : (
                  <span className="mt-auto text-[11px] text-muted-foreground">Select a workspace for templates</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <CsvImportFlow
        key={`${selected.value}-${selected.kind}`}
        kind={selected.kind}
        backHref="/settings/imports/fieldpulse"
        title={selected.title}
        description={selected.description}
        defaultSourceSystem={`FieldPulse ${selected.label}`}
      />
    </div>
  )
}
