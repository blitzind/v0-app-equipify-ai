import type { SupabaseClient } from "@supabase/supabase-js"
import type { PreviewResult } from "./public-types"

export type {
  PreviewIssue,
  PreviewSampleRow,
  PreviewResult,
} from "./public-types"

export type MigrationImportKind =
  | "customer"
  | "equipment"
  | "invoice"
  | "work_order"
  | "quote"
  | "certificate"
  | "quickbooks_snapshot"
  | "generic"

export type MigrationImportStrategy =
  | "skip_duplicates"
  | "update_empty_fields"
  | "update_existing"
  | "create_new_only"

/** @deprecated Prefer {@link MigrationImportStrategy} via `strategy`. */
export type DuplicateStrategy = "skip_duplicates" | "fail_on_duplicate"

export type MigrationCommitOptions = {
  strategy?: MigrationImportStrategy
  duplicateStrategy?: DuplicateStrategy
  /** Customer imports: when true, safely link child rows to existing same-org parent customers. */
  linkChildrenToExistingParents?: boolean
  /** When true, invoice inserts skip QuickBooks auto-sync side effects (historical rows). */
  skipQuickBooksInvoiceSync?: boolean
}

export type RowOutcome = {
  rowIndex: number
  status: "imported" | "updated" | "skipped" | "error" | "duplicate"
  codes: string[]
  message: string | null
  entityKind?: string
  entityId?: string
  /** Short label for exports (e.g. company name, invoice #) — no raw UUID in CSV. */
  matchedLabel?: string | null
}

export type CommitResult = {
  createdCount: number
  updatedCount: number
  skippedCount: number
  errorCount: number
  outcomes: RowOutcome[]
}

export type ImportEngineContext = {
  supabase: SupabaseClient
  organizationId: string
  userId: string
  columnMapping: Record<string, string>
  rows: Record<string, string>[]
  options: MigrationCommitOptions
  /** Stable prefix for `org_invoices.seed_key` uniqueness per batch (job id works well). */
  importSeedPrefix?: string
}

export async function buildPreview(ctx: ImportEngineContext & { kind: MigrationImportKind }): Promise<PreviewResult> {
  const { buildCustomerPreview } = await import("./preview-customers")
  const { buildEquipmentPreview } = await import("./preview-equipment")
  const { buildInvoicePreview } = await import("./preview-invoices")
  const { buildWorkOrderPreview } = await import("./preview-work-orders")

  switch (ctx.kind) {
    case "customer":
      return buildCustomerPreview(ctx)
    case "equipment":
      return buildEquipmentPreview(ctx)
    case "invoice":
      return buildInvoicePreview(ctx)
    case "work_order":
      return buildWorkOrderPreview(ctx)
    case "quote":
    case "certificate":
    case "quickbooks_snapshot":
    case "generic":
      return {
        rowCount: ctx.rows.length,
        truncated: false,
        duplicateHints: [],
        unresolvedRefs: [],
        sampleRows: [],
        summary: { errorRows: 0, warningRows: 0, okRows: ctx.rows.length },
      }
    default:
      return {
        rowCount: 0,
        truncated: false,
        duplicateHints: [],
        unresolvedRefs: [],
        sampleRows: [],
        summary: { errorRows: 1, warningRows: 0, okRows: 0 },
      }
  }
}

export async function runCommit(ctx: ImportEngineContext & { kind: MigrationImportKind }): Promise<CommitResult> {
  const { commitCustomers } = await import("./commit-customers")
  const { commitEquipment } = await import("./commit-equipment")
  const { commitInvoices } = await import("./commit-invoices")
  const { commitWorkOrders } = await import("./commit-work-orders")

  switch (ctx.kind) {
    case "customer":
      return commitCustomers(ctx)
    case "equipment":
      return commitEquipment(ctx)
    case "invoice":
      return commitInvoices(ctx)
    case "work_order":
      return commitWorkOrders(ctx)
    case "quote":
      return {
        createdCount: 0,
        updatedCount: 0,
        errorCount: 0,
        skippedCount: ctx.rows.length,
        outcomes: ctx.rows.map((_, i) => ({
          rowIndex: i + 1,
          status: "skipped" as const,
          codes: ["not_implemented"],
          message:
            "Quote CSV import is not available yet — use the template to align FieldPulse exports; import customers, equipment, and work orders from the other cards for now.",
        })),
      }
    case "certificate":
      return {
        createdCount: 0,
        updatedCount: 0,
        errorCount: 0,
        skippedCount: ctx.rows.length,
        outcomes: ctx.rows.map((_, i) => ({
          rowIndex: i + 1,
          status: "skipped" as const,
          codes: ["not_implemented"],
          message: "Certificate bulk import is scheduled for the next phase — store documents under Equipment for now.",
        })),
      }
    case "quickbooks_snapshot":
      return {
        createdCount: 0,
        updatedCount: 0,
        errorCount: 0,
        skippedCount: ctx.rows.length,
        outcomes: [],
      }
    default:
      return {
        createdCount: 0,
        updatedCount: 0,
        errorCount: ctx.rows.length,
        skippedCount: 0,
        outcomes: [{ rowIndex: 0, status: "error", codes: ["unknown_kind"], message: "Unsupported import kind." }],
      }
  }
}
