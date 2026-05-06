import type { SupabaseClient } from "@supabase/supabase-js"

export async function findDuplicateCatalogItemId(
  svc: SupabaseClient,
  organizationId: string,
  row: { partNumber: string; manufacturerName: string | null; name: string },
): Promise<string | null> {
  const pn = row.partNumber.trim()
  const mfg = (row.manufacturerName ?? "").trim().toLowerCase()
  const nm = row.name.trim()

  if (pn.length > 0) {
    const { data } = await svc
      .from("catalog_items")
      .select("id, manufacturer_name")
      .eq("organization_id", organizationId)
      .eq("part_number", pn)
      .limit(25)

    if (!data?.length) return null

    const sameMfg = data.find(
      (r) => ((r.manufacturer_name ?? "").trim().toLowerCase() === mfg || (!mfg && !(r.manufacturer_name ?? "").trim())),
    )
    return (sameMfg ?? data[0]).id
  }

  if (!nm) return null

  const { data } = await svc
    .from("catalog_items")
    .select("id, manufacturer_name")
    .eq("organization_id", organizationId)
    .eq("name", nm)
    .limit(25)

  if (!data?.length) return null

  const sameMfg = data.find(
    (r) => ((r.manufacturer_name ?? "").trim().toLowerCase() === mfg || (!mfg && !(r.manufacturer_name ?? "").trim())),
  )
  return (sameMfg ?? data[0]).id
}
