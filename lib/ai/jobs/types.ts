import type { AiTaskId } from "@/lib/ai/types"

/** Stored on `ai_jobs.status`. */
export type AiJobStatus = "queued" | "processing" | "completed" | "failed" | "cancelled"

/** Discriminator for `input_json`. */
export type PriceListImportJobInput =
  | {
      kind: "price_list_import_upload"
      importId: string
      storagePath: string
      fileName: string
      manufacturerName: string | null
      vendorId: string | null
    }
  | {
      kind: "price_list_import_reextract"
      importId: string
    }

export type PriceListImportJobResult = {
  kind: "price_list_import"
  importId: string
  rowCount: number
  warningCount: number
  promptId?: string
  promptVersion?: number
  schemaVersion?: string
}

export type AiJobInsert = {
  organization_id: string
  created_by: string
  task: AiTaskId | string
  status?: AiJobStatus
  input_json: Record<string, unknown>
  source_type?: string | null
  source_id?: string | null
}
