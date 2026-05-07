import { createServiceRoleSupabaseClient } from "@/lib/billing/service-role-client"
import {
  MIGRATION_IMPORT_ASYNC_MAX_ROWS,
  MIGRATION_IMPORT_MAX_ROWS,
  ORGANIZATION_IMPORTS_BUCKET,
} from "./constants"
import { parseCsvText, type ParsedCsv } from "./parse-csv"

type ServiceClient = ReturnType<typeof createServiceRoleSupabaseClient>

export async function loadJobCsvFromStorage(svc: ServiceClient, storagePath: string): Promise<ParsedCsv> {
  return loadJobCsvFromStorageWithLimit(svc, storagePath, MIGRATION_IMPORT_MAX_ROWS)
}

export async function loadJobCsvFromStorageForAsync(svc: ServiceClient, storagePath: string): Promise<ParsedCsv> {
  return loadJobCsvFromStorageWithLimit(svc, storagePath, MIGRATION_IMPORT_ASYNC_MAX_ROWS)
}

export async function loadJobCsvFromStorageWithLimit(
  svc: ServiceClient,
  storagePath: string,
  maxRows: number,
): Promise<ParsedCsv> {
  const { data, error } = await svc.storage.from(ORGANIZATION_IMPORTS_BUCKET).download(storagePath)
  if (error || !data) {
    throw new Error(error?.message ?? "Download failed")
  }
  const text = await data.text()
  return parseCsvText(text, maxRows)
}
