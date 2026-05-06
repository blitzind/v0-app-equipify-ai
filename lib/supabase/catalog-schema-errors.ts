import { NextResponse } from "next/server"

/**
 * PostgREST / Supabase errors when `catalog_items` / `price_list_imports` are missing from the DB
 * or PostgREST's schema cache does not list them yet (e.g. migrations not applied).
 *
 * Not tenant isolation issues — apply migrations or reload schema on the project.
 */
export function isCatalogDataLayerSchemaError(message: string | undefined | null): boolean {
  if (!message || typeof message !== "string") return false
  const m = message.toLowerCase()

  if (m.includes("schema cache") && (m.includes("catalog_items") || m.includes("price_list_imports"))) {
    return true
  }
  if (m.includes("pgrst205")) return true
  if (
    (m.includes("relation") || m.includes("table")) &&
    m.includes("does not exist") &&
    (m.includes("catalog_items") || m.includes("price_list_imports"))
  ) {
    return true
  }

  return false
}

const HINT_PROD =
  "Apply pending SQL migrations to your Supabase project (Dashboard → SQL Editor, or `supabase db push`). If the table exists but this persists, open Project Settings → API → reload PostgREST schema cache."

const HINT_DEV =
  "From `equipify-app`: run `supabase db reset` (local) or `supabase db push` (linked project). Migrations: `20260616100000_catalog_items_price_list_imports.sql`, `20260620120000_ai_human_verification.sql`."

export function catalogSchemaNotReadyResponse(opts?: { dev?: boolean }): NextResponse {
  const useDevHint =
    opts?.dev !== undefined ? opts.dev : process.env.NODE_ENV === "development"
  const hint = useDevHint ? HINT_DEV : HINT_PROD
  return NextResponse.json(
    {
      error: "catalog_schema_not_ready",
      message:
        "Catalog database objects are missing or not exposed to the API. Apply Supabase migrations that create `public.catalog_items` and `public.price_list_imports`.",
      hint,
    },
    { status: 503 },
  )
}

/** Use when `.from('catalog_*').*` / `price_list_imports` returns an error; returns a Response or null to fall through. */
export function maybeCatalogSchemaErrorResponse(message: string | undefined | null): NextResponse | null {
  if (!isCatalogDataLayerSchemaError(message)) return null
  return catalogSchemaNotReadyResponse()
}
