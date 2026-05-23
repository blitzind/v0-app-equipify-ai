import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { parseCsvText } from "@/lib/migration-imports/parse-csv"
import { GROWTH_IMPORTS_BUCKET, GROWTH_IMPORT_MAX_ROWS } from "@/lib/growth/import/constants"

export async function uploadGrowthImportCsv(
  admin: SupabaseClient,
  input: { batchId: string; fileName: string; bytes: Buffer },
): Promise<{ storagePath: string }> {
  const storagePath = `${input.batchId}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]+/g, "_")}`
  const { error } = await admin.storage.from(GROWTH_IMPORTS_BUCKET).upload(storagePath, input.bytes, {
    contentType: "text/csv",
    upsert: false,
  })
  if (error) throw new Error(error.message)
  return { storagePath }
}

export async function loadGrowthImportCsvFromStorage(
  admin: SupabaseClient,
  storagePath: string,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const { data, error } = await admin.storage.from(GROWTH_IMPORTS_BUCKET).download(storagePath)
  if (error || !data) throw new Error(error?.message ?? "Could not download import file.")
  const text = await data.text()
  const parsed = parseCsvText(text, GROWTH_IMPORT_MAX_ROWS)
  return parsed
}
